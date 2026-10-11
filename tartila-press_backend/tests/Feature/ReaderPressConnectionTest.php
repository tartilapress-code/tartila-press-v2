<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\PaymentMethod;
use App\Models\Reader\ReaderAccessRule;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderOrder;
use App\Models\Role;
use App\Models\User;
use App\Support\PdfPages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Royalti & keuangan Tartila Book tersambung ke Tartila Press (dompet, Royalti Saya, Keuangan). */
class ReaderPressConnectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $author;

    private User $reader;

    private PaymentMethod $account;

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
        $this->account = PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '123', 'account_holder_name' => 'Tartila', 'is_active' => true]);
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function readerBook(array $coAuthors = []): ReaderBook
    {
        $manuscript = Manuscript::create(['user_id' => $this->author->id, 'title' => 'Buku Baca', 'authors' => ['Penulis'], 'status' => 'completed']);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Buku Baca', 'authors_text' => 'Penulis Uji', 'price' => 50000, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
        $book->forceFill(['ebook_file' => "ebooks/{$manuscript->id}/uji.pdf", 'ebook_name' => 'uji.pdf', 'ebook_uploaded_at' => now(), 'ebook_pages' => 10])->save();

        if ($coAuthors !== []) {
            ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $this->author->id, 'position' => 1]);

            foreach ($coAuthors as $index => $coAuthor) {
                ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $coAuthor->id, 'position' => $index + 2]);
            }
        }

        Storage::disk('local')->put("ebooks/{$manuscript->id}/uji.pdf", '%PDF-1.4 isi');

        return ReaderBook::create(['book_id' => $book->id, 'is_published' => true]);
    }

    /** Satu pembelian 100.000 (20% = 20.000) + 5 bacaan × 100 = 500. */
    private function sell(ReaderBook $readerBook): ReaderOrder
    {
        ReaderAccessRule::create(['reader_book_id' => null, 'action' => 'open', 'starts_at' => now()->subDay()]);

        Sanctum::actingAs($this->admin);
        $this->putJson('/api/v1/admin/reader/settings', ['purchase_royalty_percent' => 20, 'read_fee' => 100])->assertOk();

        $order = ReaderOrder::create([
            'order_number' => 'RB-1', 'user_id' => $this->reader->id, 'kind' => 'book', 'reader_book_id' => $readerBook->id,
            'title' => 'Buku Baca', 'amount' => 100000, 'status' => 'confirmed', 'payment_method_id' => $this->account->id, 'confirmed_at' => now(),
        ]);

        Sanctum::actingAs($this->reader);
        $this->postJson("/api/v1/reader/books/{$readerBook->id}/reads", ['pages' => [1, 2, 3, 4, 5]])->assertOk();

        return $order;
    }

    public function test_ebook_royalty_is_a_third_source_in_the_authors_royalty_page(): void
    {
        $readerBook = $this->readerBook();
        $this->sell($readerBook);

        Sanctum::actingAs($this->author);
        $row = $this->getJson('/api/v1/royalties/mine')->assertOk()->json('data.0');

        $this->assertSame(1, $row['reader_orders']);
        $this->assertSame(5, $row['reader_read_events']);
        $this->assertEquals(20000, $row['reader_purchase_royalty']);
        $this->assertEquals(500, $row['reader_read_royalty']);
        $this->assertEquals(20500, $row['reader_royalty_amount']);
        // Total = fisik/sistem + luar sistem + ebook Tartila Book.
        $this->assertEquals(20500, $row['total_royalty_amount']);
    }

    public function test_ebook_royalty_reaches_the_wallet_and_is_split_between_co_authors(): void
    {
        $coAuthor = $this->makeUser(['penulis'], 'Rekan');
        $readerBook = $this->readerBook([$coAuthor]);
        $this->sell($readerBook);

        foreach ([$this->author, $coAuthor] as $writer) {
            Sanctum::actingAs($writer);
            $this->getJson('/api/v1/wallet')->assertOk()
                ->assertJsonPath('data.summary.by_type.ebook_royalty', 10250)
                ->assertJsonPath('data.summary.balance', 10250)
                ->assertJsonPath('data.entries.0.type', 'ebook_royalty');
        }

        // Pembaca biasa tidak mendapat royalti.
        Sanctum::actingAs($this->reader);
        $this->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('data.summary.by_type.ebook_royalty', 0);
    }

    public function test_reader_orders_enter_the_finance_ledger_balances_and_ebook_breakdown(): void
    {
        $readerBook = $this->readerBook();
        $order = $this->sell($readerBook);
        // Pesanan yang belum dikonfirmasi tidak dihitung.
        ReaderOrder::create([
            'order_number' => 'RB-2', 'user_id' => $this->reader->id, 'kind' => 'book', 'reader_book_id' => $readerBook->id,
            'title' => 'Buku Baca', 'amount' => 70000, 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->admin);

        $ledger = $this->getJson('/api/v1/admin/finance/transactions?type=ebook')->assertOk();
        $this->assertCount(1, $ledger->json('data.items'));
        $this->assertSame('reader_order', $ledger->json('data.items.0.source'));
        $this->assertEquals(100000, $ledger->json('data.items.0.amount'));

        $summary = $this->getJson('/api/v1/admin/finance/summary')->assertOk();
        $this->assertEquals(100000, $summary->json('data.all_totals.in'));
        $this->assertEquals(100000, $summary->json('data.balances.accounts.0.balance'));
        $this->assertEquals(100000, collect($summary->json('data.revenue.yearly'))->sum('amount'));

        $rows = $this->getJson('/api/v1/admin/finance/ebooks')->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertEquals(100000, $rows[0]['price']);
        $this->assertEquals(20000, $rows[0]['purchase_royalty']);
        $this->assertEquals(500, $rows[0]['read_royalty']);
        $this->assertEquals(79500, $rows[0]['profit']);

        // Rekening bisa dipindahkan seperti pesanan Press.
        $other = PaymentMethod::create(['bank_name' => 'BNI', 'account_number' => '9', 'account_holder_name' => 'Tartila', 'is_active' => true]);
        $this->patchJson("/api/v1/admin/finance/accounts/reader_order/{$order->id}", ['payment_method_id' => $other->id])->assertOk();
        $this->assertSame($other->id, $order->fresh()->payment_method_id);
    }

    public function test_subscription_revenue_is_a_separate_row_in_the_ebook_breakdown(): void
    {
        ReaderOrder::create([
            'order_number' => 'RB-9', 'user_id' => $this->reader->id, 'kind' => 'plan', 'title' => 'Bulanan',
            'amount' => 40000, 'status' => 'confirmed', 'confirmed_at' => now(),
        ]);

        Sanctum::actingAs($this->admin);
        $rows = $this->getJson('/api/v1/admin/finance/ebooks')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('subscription', $rows[0]['kind']);
        $this->assertEquals(40000, $rows[0]['profit']);
    }

    public function test_admin_royalty_page_includes_the_ebook_source(): void
    {
        $readerBook = $this->readerBook();
        $this->sell($readerBook);

        Sanctum::actingAs($this->admin);
        $row = $this->getJson('/api/v1/admin/royalties')->assertOk()->json('data.0');

        $this->assertEquals(20500, $row['reader']['total']);
        $this->assertEquals(20500, $row['shares'][0]['reader_royalty_amount']);
    }

    public function test_press_ebook_upload_feeds_tartila_book_without_a_second_upload(): void
    {
        $manuscript = Manuscript::create(['user_id' => $this->author->id, 'title' => 'Satu Unggahan', 'authors' => ['P'], 'status' => 'completed']);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Satu Unggahan', 'price' => 1, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
        $readerBook = ReaderBook::create(['book_id' => $book->id, 'is_published' => true]);

        // Belum ada ebook di Press: tidak tampil di katalog baca.
        $this->assertFalse($readerBook->fresh()->hasFile());
        $this->getJson('/api/v1/reader/books')->assertJsonPath('meta.total', 0);

        Sanctum::actingAs($this->admin);
        // EPUB tidak bisa dibaca di Tartila Book.
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => UploadedFile::fake()->create('a.epub', 50, 'application/epub+zip'), 'page_count' => 5], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.in_tartila_book', false);
        $this->getJson('/api/v1/reader/books')->assertJsonPath('meta.total', 0);

        // PDF + jumlah halaman dari peramban: langsung tampil dan bisa dibaca.
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => UploadedFile::fake()->create('a.pdf', 50, 'application/pdf'), 'page_count' => 7], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.in_tartila_book', true)->assertJsonPath('data.ebook_pages', 7);
        $this->getJson('/api/v1/reader/books')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.page_count', 7);

        // Admin Tartila Book tidak bisa unggah lagi; hapus ebook di Press menyembunyikan bukunya.
        $this->post("/api/v1/admin/reader/books/{$readerBook->id}/file", ['file' => UploadedFile::fake()->create('b.pdf', 50, 'application/pdf')], ['Accept' => 'application/json'])->assertStatus(404);
        $this->deleteJson("/api/v1/admin/books/{$book->id}/ebook")->assertOk();
        $this->getJson('/api/v1/reader/books')->assertJsonPath('meta.total', 0);
    }

    public function test_pdf_page_counter_reads_the_page_tree_root(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'pdf');
        file_put_contents($path, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>\nendobj\n");

        $this->assertSame(3, PdfPages::count($path));

        file_put_contents($path, 'bukan pdf');
        $this->assertNull(PdfPages::count($path));

        unlink($path);
    }
}
