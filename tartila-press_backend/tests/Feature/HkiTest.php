<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\FinanceSetting;
use App\Models\HkiRecord;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HkiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name, 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** Pesanan paket yang dibayar; $facilities menentukan ada/tidaknya HKI. */
    private function packageOrder(User $buyer, array $facilities, string $status = 'confirmed'): Order
    {
        $package = Package::create(['name' => 'Paket '.uniqid(), 'price' => 1000000, 'discount' => 0, 'facilities' => $facilities, 'created_by' => $this->admin->id]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $buyer->id, 'status' => $status, 'subtotal' => 1000000, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1000000]);
        $order->items()->create(['itemable_type' => Package::class, 'itemable_id' => $package->id, 'name' => $package->name, 'quantity' => 1, 'unit_price' => 1000000, 'subtotal' => 1000000, 'discount' => 0]);
        $order->logStatusHistory('payment_confirmed');

        return $order;
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('sertifikat-hki.pdf', "%PDF-1.4\n%%EOF\n");
    }

    public function test_admin_lists_works_with_hki_and_their_book_status(): void
    {
        $writer = $this->makeUser(['penulis'], 'Penulis Satu');
        $coWriter = $this->makeUser(['penulis'], 'Penulis Dua');

        $withHki = $this->packageOrder($writer, ['ISBN', 'HKI']);
        $manuscript = Manuscript::create(['order_id' => $withHki->id, 'user_id' => $writer->id, 'title' => 'Sistem Tertanam', 'authors' => ['a'], 'status' => 'in_editing']);
        $manuscript->authorLinks()->create(['user_id' => $writer->id, 'position' => 1]);
        $manuscript->authorLinks()->create(['user_id' => $coWriter->id, 'position' => 2]);

        $this->packageOrder($writer, ['ISBN']);                               // tanpa HKI
        $this->packageOrder($writer, ['HAKI'], 'pending');                    // belum dibayar
        $noManuscript = $this->packageOrder($coWriter, ['Hak Kekayaan', 'HKI']);

        $project = Book::create(['title' => 'Buku Bersama', 'price' => 100000, 'includes_hki' => true, 'created_by' => $this->admin->id]);
        $project->forceFill(['is_chapter_offering' => true])->save();
        $chapterAuthor = $this->makeUser(['penulis'], 'Penulis Bab');
        $chapterOrder = Order::create(['order_number' => 'ORD-BAB', 'user_id' => $chapterAuthor->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $chapterManuscript = Manuscript::create(['order_id' => $chapterOrder->id, 'user_id' => $chapterAuthor->id, 'title' => 'Bab 1', 'authors' => ['b'], 'status' => 'submitted']);
        BookChapter::create(['book_id' => $project->id, 'chapter_number' => 1, 'title' => 'Bab 1', 'order_id' => $chapterOrder->id, 'manuscript_id' => $chapterManuscript->id]);
        BookChapter::create(['book_id' => $project->id, 'chapter_number' => 2, 'title' => 'Bab 2']);

        $this->getJson('/api/v1/admin/hki')->assertUnauthorized();
        Sanctum::actingAs($writer);
        $this->getJson('/api/v1/admin/hki')->assertForbidden();

        Sanctum::actingAs($this->admin);
        $rows = collect($this->getJson('/api/v1/admin/hki')->assertOk()->json('data'))->keyBy('key');

        $this->assertEqualsCanonicalizing(["order:{$withHki->id}", "order:{$noManuscript->id}", "book:{$project->id}"], $rows->keys()->all());
        $this->assertSame('Sistem Tertanam', $rows["order:{$withHki->id}"]['title']);
        $this->assertSame(['Penulis Satu', 'Penulis Dua'], array_column($rows["order:{$withHki->id}"]['authors'], 'name'));
        $this->assertSame('Sedang diedit', $rows["order:{$withHki->id}"]['book_status']);
        $this->assertSame('Naskah belum dikirim', $rows["order:{$noManuscript->id}"]['book_status']);
        $this->assertSame('Pengumpulan bab (1/2 terisi)', $rows["book:{$project->id}"]['book_status']);
        $this->assertSame(['Penulis Bab'], array_column($rows["book:{$project->id}"]['authors'], 'name'));
        $this->assertSame('Belum diajukan', $rows["book:{$project->id}"]['hki']['status_label']);

        // Buku terbit → status "Terbit".
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Sistem Tertanam', 'price' => 90000, 'isbn' => '978-1', 'created_by' => $this->admin->id]);
        $this->assertSame('Terbit (ISBN 978-1)', collect($this->getJson('/api/v1/admin/hki')->json('data'))->firstWhere('key', "order:{$withHki->id}")['book_status']);
        $this->assertNotNull($book);

        // Status & nomor HKI; karya tanpa HKI ditolak.
        $this->putJson("/api/v1/admin/hki/order/{$withHki->id}", ['status' => 'submitted', 'application_number' => 'EC00202612345'])->assertOk();
        $this->assertSame('Sedang diproses', collect($this->getJson('/api/v1/admin/hki')->json('data'))->firstWhere('key', "order:{$withHki->id}")['hki']['status_label']);
        $without = Order::where('status', 'confirmed')->whereNotIn('id', [$withHki->id, $noManuscript->id, $chapterOrder->id])->firstOrFail();
        $this->putJson("/api/v1/admin/hki/order/{$without->id}", ['status' => 'submitted'])->assertNotFound();
    }

    public function test_certificate_reaches_every_author_and_nobody_else(): void
    {
        $writer = $this->makeUser(['penulis'], 'Penulis Satu');
        $coWriter = $this->makeUser(['penulis'], 'Penulis Dua');
        $stranger = $this->makeUser(['penulis'], 'Orang Lain');
        $order = $this->packageOrder($writer, ['HKI']);
        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $writer->id, 'title' => 'Sistem Tertanam', 'authors' => ['a'], 'status' => 'completed']);
        $manuscript->authorLinks()->create(['user_id' => $writer->id, 'position' => 1]);
        $manuscript->authorLinks()->create(['user_id' => $coWriter->id, 'position' => 2]);

        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/hki/order/{$order->id}/certificate", ['file' => UploadedFile::fake()->create('x.exe', 10)], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post("/api/v1/admin/hki/order/{$order->id}/certificate", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();

        $record = HkiRecord::firstOrFail();
        $this->assertSame('registered', $record->status);
        $this->assertArrayNotHasKey('certificate_path', $this->getJson('/api/v1/admin/hki')->json('data.0.hki'));

        // Semua penulis: muncul di Sertifikat Saya + notifikasi; bisa diunduh.
        foreach ([$writer, $coWriter] as $author) {
            Sanctum::actingAs($author);
            $this->getJson('/api/v1/hki-certificates')->assertOk()
                ->assertJsonPath('data.0.title', 'Sistem Tertanam')
                ->assertJsonPath('data.0.is_pdf', true);
            $this->get("/api/v1/hki-certificates/{$record->id}/download")->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertTrue(UserNotification::where('user_id', $author->id)->where('title', 'Sertifikat HKI tersedia')->exists());
        }

        // Orang lain tidak bisa melihat atau mengunduh.
        Sanctum::actingAs($stranger);
        $this->getJson('/api/v1/hki-certificates')->assertOk()->assertJsonCount(0, 'data');
        $this->get("/api/v1/hki-certificates/{$record->id}/download")->assertNotFound();
        $this->get("/api/v1/admin/hki/records/{$record->id}/certificate")->assertForbidden();

        // Ganti berkas: berkas lama dihapus; hapus sertifikat → hilang dari penulis.
        $oldPath = $record->certificate_path;
        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/hki/order/{$order->id}/certificate", ['file' => UploadedFile::fake()->createWithContent('baru.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('local')->assertMissing($oldPath);
        $this->deleteJson("/api/v1/admin/hki/records/{$record->id}/certificate")->assertOk();
        Sanctum::actingAs($writer);
        $this->getJson('/api/v1/hki-certificates')->assertJsonCount(0, 'data');
    }

    public function test_book_chapter_certificate_goes_to_every_chapter_author(): void
    {
        $project = Book::create(['title' => 'Buku Bersama', 'price' => 100000, 'includes_hki' => true, 'created_by' => $this->admin->id]);
        $project->forceFill(['is_chapter_offering' => true])->save();
        $authors = [];

        foreach ([1, 2] as $number) {
            $author = $this->makeUser(['penulis'], "Penulis Bab {$number}");
            $order = Order::create(['order_number' => "ORD-B{$number}", 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
            $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $author->id, 'title' => "Bab {$number}", 'authors' => ['x'], 'status' => 'compiled']);
            BookChapter::create(['book_id' => $project->id, 'chapter_number' => $number, 'title' => "Bab {$number}", 'order_id' => $order->id, 'manuscript_id' => $manuscript->id]);
            $authors[] = $author;
        }

        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/hki/book/{$project->id}/certificate", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();

        foreach ($authors as $author) {
            Sanctum::actingAs($author);
            $this->getJson('/api/v1/hki-certificates')->assertJsonPath('data.0.title', 'Buku Bersama');
        }
    }

    public function test_hki_capital_cost_defaults_to_220k_and_is_editable_for_finance(): void
    {
        $writer = $this->makeUser(['penulis'], 'Penulis');
        $this->packageOrder($writer, ['HKI']);

        Sanctum::actingAs($this->admin);
        $this->assertEquals(220000, $this->getJson('/api/v1/admin/finance/settings')->json('data.hki_cost'));
        $this->assertEquals(220000, $this->getJson('/api/v1/admin/finance/packages')->json('data.packages.0.hki'));

        $this->putJson('/api/v1/admin/finance/settings', ['admin_cover_cost' => 50000, 'print_cost_percent' => 20, 'base_print_copies' => 3, 'default_book_price' => 0, 'hki_cost' => 250000])->assertOk();
        $this->assertEquals(250000, FinanceSetting::current()->hki_cost);
        $this->assertEquals(250000, $this->getJson('/api/v1/admin/finance/packages')->json('data.packages.0.hki'));
    }
}
