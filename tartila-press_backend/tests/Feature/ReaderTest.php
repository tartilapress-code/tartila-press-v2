<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\PaymentMethod;
use App\Models\Reader\ReaderAccessRule;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderEntitlement;
use App\Models\Reader\ReaderOrder;
use App\Models\Reader\ReaderPlan;
use App\Models\Reader\ReaderTerm;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Tartila Book: katalog, akses (gratis/langganan/beli/penulis), hitungan baca, royalti. */
class ReaderTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $author;

    private User $reader;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
        $this->author = $this->makeUser(['penulis'], 'Penulis');
        $this->reader = $this->makeUser(['user'], 'Pembaca');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** Buku terbit milik $this->author yang sudah ada di Tartila Book (dipublikasikan, 10 halaman). */
    private function readerBook(array $attributes = [], string $title = 'Buku Baca'): ReaderBook
    {
        $manuscript = Manuscript::create(['user_id' => $this->author->id, 'title' => $title, 'authors' => ['Penulis'], 'status' => 'completed']);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => $title, 'authors_text' => 'Penulis Uji', 'price' => 50000, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
        // Ebook diunggah sekali di Tartila Press; Tartila Book membacanya dari sana.
        $book->forceFill(['ebook_file' => "ebooks/{$manuscript->id}/uji.pdf", 'ebook_name' => 'uji.pdf', 'ebook_uploaded_at' => now(), 'ebook_pages' => 10])->save();

        Storage::disk('local')->put("ebooks/{$manuscript->id}/uji.pdf", '%PDF-1.4 isi');

        return ReaderBook::create($attributes + ['book_id' => $book->id, 'is_published' => true]);
    }

    private function pay(ReaderOrder $order): void
    {
        Sanctum::actingAs($this->reader);
        $this->post("/api/v1/reader/orders/{$order->id}/proof", ['file' => UploadedFile::fake()->image('bukti.png')], ['Accept' => 'application/json'])->assertOk();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/orders/{$order->id}/verify", ['decision' => 'approve'])->assertOk();
    }

    public function test_locked_book_cannot_be_read_until_free_window_purchase_or_subscription(): void
    {
        $readerBook = $this->readerBook(['price' => 30000, 'access_days' => 7]);
        PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '1', 'account_holder_name' => 'Tartila', 'is_active' => true]);

        // Tamu: katalog & detail terbuka, berkas tidak.
        $this->getJson('/api/v1/reader/books')->assertOk()->assertJsonPath('data.0.free_now', false)->assertJsonPath('meta.total', 1);
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertOk()->assertJsonPath('data.can_read_now', false);
        $this->getJson("/api/v1/reader/books/{$readerBook->id}/file")->assertUnauthorized();

        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$readerBook->id}/file")->assertForbidden();
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.me.access.reason', 'locked');

        // Beli buku: pesanan → bukti → admin ACC → akses terbatas waktu.
        $methodId = PaymentMethod::first()->id;
        $this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $readerBook->id])->assertStatus(422);
        $order = $this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $readerBook->id, 'payment_method_id' => $methodId])->assertCreated()->json('data');
        // Pesanan sama yang masih menunggu dipakai ulang.
        $this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $readerBook->id, 'payment_method_id' => $methodId])->assertCreated()->assertJsonPath('data.id', $order['id']);

        $this->pay(ReaderOrder::find($order['id']));

        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$readerBook->id}/file")->assertOk();
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.me.access.reason', 'purchase');
        $this->assertTrue(UserNotification::where('user_id', $this->reader->id)->where('category', 'reader')->where('title', 'Pembayaran dikonfirmasi')->exists());

        // Lewat batas waktu 7 hari → terkunci lagi.
        Carbon::setTestNow(now()->addDays(8));
        $this->get("/api/v1/reader/books/{$readerBook->id}/file")->assertForbidden();
        Carbon::setTestNow();

        // Jadwal dibuka (baca gratis) untuk buku itu.
        ReaderAccessRule::create(['reader_book_id' => $readerBook->id, 'action' => 'open', 'starts_at' => now()->subHour(), 'ends_at' => now()->addDay()]);
        $this->getJson('/api/v1/reader/books')->assertJsonPath('data.0.free_now', true);

        // Pembeli yang aksesnya masih berjalan tetap tercatat "beli"; pembaca lain "gratis".
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.me.access.reason', 'purchase');
        Sanctum::actingAs($this->makeUser(['user'], 'Pembaca Lain'));
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.me.access.reason', 'free');
        $this->get("/api/v1/reader/books/{$readerBook->id}/file")->assertOk();
    }

    public function test_lock_rule_overrides_global_free_window_but_not_paid_access_or_authors(): void
    {
        $open = $this->readerBook([], 'Buku Terbuka');
        $locked = $this->readerBook([], 'Buku Dikunci');

        // Semua buku dibuka, kecuali satu judul dikunci.
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDay(), 'ends_at' => null]);
        ReaderAccessRule::create(['reader_book_id' => $locked->id, 'action' => 'lock', 'starts_at' => now()->subHour(), 'ends_at' => null]);

        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$open->id}/file")->assertOk();
        $this->get("/api/v1/reader/books/{$locked->id}/file")->assertForbidden();

        // Penulis selalu bisa membaca bukunya sendiri.
        Sanctum::actingAs($this->author);
        $this->get("/api/v1/reader/books/{$locked->id}/file")->assertOk();
        $this->getJson("/api/v1/reader/books/{$locked->id}")->assertJsonPath('data.me.access.reason', 'author');

        // Aturan yang sudah lewat tidak berlaku.
        ReaderAccessRule::query()->delete();
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDays(3), 'ends_at' => now()->subDay()]);
        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$open->id}/file")->assertForbidden();
    }

    public function test_subscription_unlocks_every_book_for_its_period_and_extends_when_renewed(): void
    {
        $a = $this->readerBook([], 'Satu');
        $b = $this->readerBook([], 'Dua');
        $plan = ReaderPlan::create(['name' => 'Mingguan', 'period' => 'weekly', 'price' => 25000]);

        Sanctum::actingAs($this->reader);
        $order = ReaderOrder::find($this->postJson('/api/v1/reader/orders', ['kind' => 'plan', 'target_id' => $plan->id])->assertCreated()->json('data.id'));
        $this->pay($order);

        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$a->id}/file")->assertOk();
        $this->get("/api/v1/reader/books/{$b->id}/file")->assertOk();
        $this->getJson('/api/v1/reader/me/access')->assertOk()->assertJsonPath('data.subscription.plan', 'Mingguan');

        // Perpanjang saat masih aktif: disambung setelah masa berjalan.
        $first = now()->addWeek();
        $second = ReaderOrder::find($this->postJson('/api/v1/reader/orders', ['kind' => 'plan', 'target_id' => $plan->id])->json('data.id'));
        $this->pay($second);
        $end = Carbon::parse(ReaderEntitlement::where('kind', 'plan')->max('ends_at'));
        $this->assertEqualsWithDelta($first->copy()->addWeek()->timestamp, $end->timestamp, 5);

        Carbon::setTestNow(now()->addDays(15));
        Sanctum::actingAs($this->reader);
        $this->get("/api/v1/reader/books/{$a->id}/file")->assertForbidden();
    }

    public function test_unpaid_orders_are_cancelled_after_24_hours_and_rejected_proofs_cancel_the_order(): void
    {
        $readerBook = $this->readerBook(['price' => 20000]);

        Sanctum::actingAs($this->reader);
        $order = ReaderOrder::find($this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $readerBook->id])->json('data.id'));

        Carbon::setTestNow(now()->addHours(25));
        $this->artisan('reader:cancel-unpaid')->assertSuccessful();
        $this->assertSame('cancelled', $order->fresh()->status);

        Carbon::setTestNow();
        $second = ReaderOrder::find($this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $readerBook->id])->json('data.id'));
        $this->post("/api/v1/reader/orders/{$second->id}/proof", ['file' => UploadedFile::fake()->image('b.png')], ['Accept' => 'application/json'])->assertOk();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/orders/{$second->id}/verify", ['decision' => 'reject', 'note' => 'Nominal kurang'])->assertOk();
        $this->assertSame('cancelled', $second->fresh()->status);

        // Tidak dijual satuan → tidak bisa dibeli.
        $free = $this->readerBook(['price' => null], 'Tanpa Harga');
        Sanctum::actingAs($this->reader);
        $this->postJson('/api/v1/reader/orders', ['kind' => 'book', 'target_id' => $free->id])->assertStatus(422);
    }

    public function test_reads_are_counted_per_page_per_day_and_authors_are_excluded(): void
    {
        $readerBook = $this->readerBook();
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDay()]);
        $other = $this->makeUser(['user'], 'Pembaca Dua');

        Sanctum::actingAs($this->reader);
        // 3 halaman → 3 bacaan; ulang hari yang sama tetap 3.
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1, 2, 3]])->assertOk()->assertJsonPath('data.counted', 3);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [2, 3, 4]])->assertOk()->assertJsonPath('data.counted', 1);
        // Halaman di luar buku diabaikan.
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [99]])->assertOk()->assertJsonPath('data.counted', 0);
        $this->assertSame(4, $readerBook->fresh()->read_events);

        // Hari lain: halaman yang sama dihitung lagi.
        Carbon::setTestNow(now()->addDay());
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1]])->assertOk()->assertJsonPath('data.counted', 1);
        $this->assertSame(5, $readerBook->fresh()->read_events);
        // Pembaca yang sama di halaman 1 → pembaca berbeda tetap 1.
        $this->assertSame(1, $readerBook->fresh()->top_page_readers);

        // Pembaca lain membuka halaman 1 → rekor 2.
        Sanctum::actingAs($other);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1]])->assertOk();
        $this->assertSame(2, $readerBook->fresh()->top_page_readers);
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.top_page_readers', 2);

        // Penulis: dicatat tapi tidak dihitung.
        Sanctum::actingAs($this->author);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1, 2]])->assertOk()->assertJsonPath('data.counted', 0);
        $this->assertSame(6, $readerBook->fresh()->read_events);

        // Buku terkunci: tidak bisa mencatat bacaan.
        ReaderAccessRule::query()->delete();
        Sanctum::actingAs($other);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [5]])->assertForbidden();
    }

    public function test_royalty_report_combines_purchase_percentage_and_read_fee_split_between_authors(): void
    {
        $readerBook = $this->readerBook(['price' => 100000]);
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDay()]);

        Sanctum::actingAs($this->admin);
        $this->putJson('/api/v1/admin/reader/settings', ['purchase_royalty_percent' => 20, 'read_fee' => 100])->assertOk();

        // 1 pembelian 100.000 → 20% = 20.000; 5 bacaan × 100 = 500.
        $order = ReaderOrder::create(['order_number' => 'RB-1', 'user_id' => $this->reader->id, 'kind' => 'book', 'reader_book_id' => $readerBook->id, 'title' => 'Buku', 'amount' => 100000, 'status' => 'confirmed', 'confirmed_at' => now()]);
        Sanctum::actingAs($this->reader);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1, 2, 3, 4, 5]])->assertOk();

        Sanctum::actingAs($this->admin);
        $report = $this->getJson('/api/v1/admin/reader/royalties?from='.now('Asia/Jakarta')->toDateString().'&to='.now('Asia/Jakarta')->toDateString())->assertOk();
        $report->assertJsonPath('data.0.purchase_royalty', 20000)
            ->assertJsonPath('data.0.read_events', 5)
            ->assertJsonPath('data.0.read_royalty', 500)
            ->assertJsonPath('data.0.total', 20500)
            ->assertJsonPath('data.0.authors.0.amount', 20500)
            ->assertJsonPath('meta.totals.total', 20500);

        // Biaya khusus buku mengalahkan pengaturan umum.
        $readerBook->update(['read_fee' => 1000, 'purchase_royalty_percent' => 10]);
        $this->getJson('/api/v1/admin/reader/royalties?from='.now('Asia/Jakarta')->toDateString().'&to='.now('Asia/Jakarta')->toDateString())
            ->assertJsonPath('data.0.total', 15000);

        // Penulis melihat royalti bukunya sendiri.
        Sanctum::actingAs($this->author);
        $this->getJson('/api/v1/reader/me/royalty')->assertOk()->assertJsonPath('data.my_total', 15000);

        // Pembaca biasa tidak melihat apa-apa.
        Sanctum::actingAs($this->reader);
        $this->getJson('/api/v1/reader/me/royalty')->assertOk()->assertJsonPath('data.my_total', 0);
        $this->getJson('/api/v1/admin/reader/royalties')->assertForbidden();
        $this->assertNotNull($order->id);
    }

    public function test_interactions_bookmarks_progress_and_notifications_for_saved_books(): void
    {
        $readerBook = $this->readerBook();
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDay()]);

        Sanctum::actingAs($this->reader);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/like")->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/like")->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/save")->assertOk();
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/comments", ['body' => 'Bagus sekali'])->assertCreated();
        $this->putJson("/api/v1/reader/books/{$readerBook->id}/progress", ['page' => 4])->assertOk();
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/bookmarks", ['page' => 3, 'note' => 'Bab penting'])->assertCreated();
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/bookmarks", ['page' => 3, 'note' => 'Diubah'])->assertCreated();
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/bookmarks", ['page' => 11])->assertStatus(422);

        $this->getJson("/api/v1/reader/books/{$readerBook->id}/bookmarks")->assertJsonCount(1, 'data')->assertJsonPath('data.0.note', 'Diubah');
        $this->getJson('/api/v1/reader/me/shelf?tab=saved')->assertJsonPath('data.0.id', $readerBook->id)->assertJsonPath('data.0.me.last_page', 4);
        $this->getJson('/api/v1/reader/me/shelf?tab=liked')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/reader/me/shelf?tab=reading')->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.likes_count', 1)->assertJsonPath('data.comments_count', 1)->assertJsonPath('data.saves_count', 1);
        $comments = $this->getJson("/api/v1/reader/books/{$readerBook->id}/comments")->assertOk();
        $comments->assertJsonPath('data.0.body', 'Bagus sekali');
        $this->assertArrayNotHasKey('email', $comments->json('data.0.user'));

        // Komentar hanya bisa dihapus pemilik / admin.
        $id = $comments->json('data.0.id');
        Sanctum::actingAs($this->author);
        $this->deleteJson("/api/v1/reader/comments/{$id}")->assertForbidden();

        // Admin mengganti ebook di Tartila Press → yang menyimpan buku diberi tahu (hanya di Tartila Book).
        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/books/{$readerBook->book_id}/ebook", ['file' => UploadedFile::fake()->create('baru.pdf', 100, 'application/pdf'), 'page_count' => 12], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.in_tartila_book', true)->assertJsonPath('data.ebook_pages', 12);
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertJsonPath('data.version', 2)->assertJsonPath('data.page_count', 12);

        Sanctum::actingAs($this->reader);
        $this->getJson('/api/v1/notifications?scope=reader')->assertOk()->assertJsonPath('data.0.title', 'Buku diperbarui');
        $this->assertSame(0, count($this->getJson('/api/v1/notifications')->json('data')));
        $this->getJson('/api/v1/notifications/summary?scope=reader')->assertJsonPath('data.unread_total', 1);
        $this->getJson('/api/v1/notifications/summary')->assertJsonPath('data.unread_total', 0);

        $this->deleteJson("/api/v1/reader/comments/{$id}")->assertOk();
    }

    public function test_catalog_filters_by_pustaka_taxonomy_age_language_and_search(): void
    {
        $edu = ReaderTerm::create(['type' => 'education_field', 'name' => 'Pendidikan Dasar']);
        $cat = ReaderTerm::create(['type' => 'category', 'name' => 'Novel', 'pustaka' => 'fiksi']);
        $genre = ReaderTerm::create(['type' => 'genre', 'name' => 'Misteri']);

        $nonfiction = $this->readerBook(['pustaka' => 'non_fiksi', 'education_field_id' => $edu->id, 'language' => 'id'], 'Belajar Membaca');
        $fiction = $this->readerBook(['pustaka' => 'fiksi', 'category_id' => $cat->id, 'genre_id' => $genre->id, 'age_limit' => '13', 'language' => 'en'], 'Detective Story');
        $this->readerBook(['is_published' => false], 'Belum Terbit');

        $ids = fn (string $query) => collect($this->getJson('/api/v1/reader/books'.$query)->assertOk()->json('data'))->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$nonfiction->id, $fiction->id], $ids(''));
        $this->assertSame([$fiction->id], $ids('?pustaka=fiksi'));
        $this->assertSame([$nonfiction->id], $ids("?education_field_id={$edu->id}"));
        $this->assertSame([$fiction->id], $ids("?category_id={$cat->id}&genre_id={$genre->id}"));
        $this->assertSame([$fiction->id], $ids('?age_limit=13'));
        $this->assertSame([$fiction->id], $ids('?language=en'));
        $this->assertSame([$fiction->id], $ids('?q=detective'));

        $filters = $this->getJson('/api/v1/reader/filters')->assertOk();
        $filters->assertJsonPath('data.education_fields.0.name', 'Pendidikan Dasar')->assertJsonPath('data.categories.0.pustaka', 'fiksi');
        $this->assertEqualsCanonicalizing(['en', 'id'], collect($filters->json('data.languages'))->pluck('value')->all());

        // Buku yang belum dipublikasikan tidak bisa dibuka.
        $hidden = ReaderBook::where('is_published', false)->first();
        $this->getJson("/api/v1/reader/books/{$hidden->id}")->assertNotFound();
    }

    public function test_admin_manages_books_taxonomy_plans_and_rules_and_everyone_else_is_blocked(): void
    {
        $manuscript = Manuscript::create(['user_id' => $this->author->id, 'title' => 'Calon', 'authors' => ['A'], 'status' => 'completed']);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Calon', 'price' => 1, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);

        Sanctum::actingAs($this->admin);
        $term = $this->postJson('/api/v1/admin/reader/terms', ['type' => 'genre', 'name' => 'Fantasi'])->assertCreated()->json('data');
        $this->postJson('/api/v1/admin/reader/terms', ['type' => 'genre', 'name' => 'fantasi'])->assertStatus(422);
        // Hanya buku yang ebook PDF-nya sudah diunggah di Tartila Press yang bisa ditambahkan.
        $this->getJson('/api/v1/admin/reader/books/candidates')->assertJsonCount(0, 'data');
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => UploadedFile::fake()->create('a.pdf', 50, 'application/pdf'), 'page_count' => 8], ['Accept' => 'application/json'])->assertOk();
        $this->getJson('/api/v1/admin/reader/books/candidates')->assertJsonPath('data.0.id', $book->id);

        $created = $this->postJson('/api/v1/admin/reader/books', ['book_id' => $book->id, 'pustaka' => 'fiksi', 'genre_id' => $term['id'], 'price' => 15000])->assertCreated()->json('data');
        $this->postJson('/api/v1/admin/reader/books', ['book_id' => $book->id])->assertStatus(422);
        $this->getJson('/api/v1/admin/reader/books/candidates')->assertJsonCount(0, 'data');

        // Genre harus bertipe genre.
        $edu = ReaderTerm::create(['type' => 'education_field', 'name' => 'Bidang']);
        $this->patchJson("/api/v1/admin/reader/books/{$created['id']}", ['genre_id' => $edu->id])->assertStatus(422);

        $this->post("/api/v1/admin/reader/books/{$created['id']}/file", ['file' => UploadedFile::fake()->create('a.pdf', 50, 'application/pdf')], ['Accept' => 'application/json'])->assertStatus(404);
        $this->patchJson("/api/v1/admin/reader/books/{$created['id']}", ['is_published' => true])->assertOk()->assertJsonPath('data.is_published', true);
        $this->getJson('/api/v1/reader/books')->assertJsonPath('meta.total', 1);

        $plan = $this->postJson('/api/v1/admin/reader/plans', ['name' => 'Harian', 'period' => 'daily', 'price' => 5000])->assertCreated()->json('data');
        $this->postJson('/api/v1/admin/reader/plans', ['name' => 'X', 'period' => 'hourly', 'price' => 5000])->assertStatus(422);
        $this->deleteJson("/api/v1/admin/reader/plans/{$plan['id']}")->assertOk();
        $this->getJson('/api/v1/reader/plans')->assertJsonCount(0, 'data');

        $this->postJson('/api/v1/admin/reader/rules', ['reader_book_id' => $created['id'], 'action' => 'open', 'starts_at' => now()->subHour()->toIso8601String(), 'ends_at' => now()->addDay()->toIso8601String()])->assertCreated();
        $this->getJson('/api/v1/admin/reader/rules')->assertJsonPath('data.0.active', true)->assertJsonPath('data.0.title', 'Calon');
        $this->postJson('/api/v1/admin/reader/rules', ['action' => 'open', 'starts_at' => now()->toIso8601String(), 'ends_at' => now()->subDay()->toIso8601String()])->assertStatus(422);

        // Hanya admin.
        foreach ([$this->reader, $this->author] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/v1/admin/reader/books')->assertForbidden();
            $this->getJson('/api/v1/admin/reader/orders')->assertForbidden();
            $this->putJson('/api/v1/admin/reader/settings', ['purchase_royalty_percent' => 1, 'read_fee' => 1])->assertForbidden();
        }

        $this->assertSame(1, ReaderBook::count());
    }
}
