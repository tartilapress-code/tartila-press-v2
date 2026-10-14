<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Partner;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderOrder;
use App\Models\Role;
use App\Models\User;
use App\Services\Reader\PartnerBookService;
use App\Services\Reader\ReaderRoyaltyService;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Mitra Tartila Book: unggah manual, persetujuan admin, bagi hasil, dan pembatasan di Tartila Press. */
class PartnerBookTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mitra;

    private User $author;

    private Partner $partner;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin', 'mitra'] as $name) {
            Role::firstOrCreate(['name' => $name], ['display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
        $this->mitra = $this->makeUser(['mitra'], 'Mitra');
        $this->author = $this->makeUser(['user'], 'Penulis Mitra');
        $this->partner = Partner::create(['user_id' => $this->mitra->id, 'company_name' => 'Penerbit Mitra', 'is_active' => true]);
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function pdf(string $name = 'x.pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, 100, 'application/pdf');
    }

    /** Draft lengkap (ebook + tiga dokumen); mengembalikan id buku. */
    private function completeDraft(): int
    {
        Sanctum::actingAs($this->mitra);

        $id = $this->postJson('/api/v1/partner/books', [
            'title' => 'Buku Mitra',
            'description' => 'Deskripsi buku mitra yang cukup panjang.',
            'front_cover' => 'https://example.com/cover.jpg',
            'author_ids' => [$this->author->id],
            'pustaka' => 'non_fiksi',
            'language' => 'id',
            'price' => 50000,
        ])->assertCreated()->json('data.id');

        $this->post("/api/v1/partner/books/{$id}/ebook", ['file' => $this->pdf('e.pdf'), 'page_count' => 120], ['Accept' => 'application/json'])->assertOk();
        $this->post("/api/v1/partner/books/{$id}/documents/turnitin", ['file' => $this->pdf(), 'percent' => 12.5], ['Accept' => 'application/json'])->assertOk();
        $this->post("/api/v1/partner/books/{$id}/documents/originality", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();
        $this->post("/api/v1/partner/books/{$id}/documents/mou", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();

        return $id;
    }

    private function listedIds(): array
    {
        return collect($this->getJson('/api/v1/reader/books')->assertOk()->json('data'))->pluck('id')->all();
    }

    public function test_admin_makes_a_mitra_but_not_from_an_account_with_another_role(): void
    {
        Sanctum::actingAs($this->admin);

        $fresh = $this->makeUser(['user'], 'Calon Mitra');
        $this->postJson('/api/v1/admin/reader/partners', ['user_id' => $fresh->id, 'company_name' => 'PT Baru'])->assertCreated();
        $this->assertTrue($fresh->fresh()->isPartner());

        $penulis = $this->makeUser(['penulis'], 'Sudah Penulis');
        $this->postJson('/api/v1/admin/reader/partners', ['user_id' => $penulis->id, 'company_name' => 'PT X'])->assertStatus(422);
    }

    public function test_only_mitra_can_use_the_partner_area(): void
    {
        Sanctum::actingAs($this->author);
        $this->getJson('/api/v1/partner/books')->assertForbidden();

        Sanctum::actingAs($this->mitra);
        $this->getJson('/api/v1/partner/books')->assertOk();
        $this->getJson('/api/v1/admin/reader/partners')->assertForbidden();
    }

    public function test_a_book_needs_everything_before_it_can_be_submitted(): void
    {
        Sanctum::actingAs($this->mitra);

        $id = $this->postJson('/api/v1/partner/books', ['title' => 'Draft', 'author_ids' => [$this->author->id], 'pustaka' => 'fiksi', 'language' => 'id'])->assertCreated()->json('data.id');

        $this->postJson("/api/v1/partner/books/{$id}/submit")
            ->assertStatus(422)
            ->assertJsonValidationErrors('book');

        // Penulis wajib akun yang ada; Turnitin harus di bawah 20%.
        $this->postJson('/api/v1/partner/books', ['title' => 'X', 'author_ids' => [999999], 'pustaka' => 'fiksi', 'language' => 'id'])->assertStatus(422);
        $this->post("/api/v1/partner/books/{$id}/documents/turnitin", ['file' => $this->pdf(), 'percent' => 20], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('percent');
    }

    public function test_only_admin_approved_ebooks_reach_the_catalog_and_rejections_carry_a_note(): void
    {
        $id = $this->completeDraft();

        $this->postJson("/api/v1/partner/books/{$id}/submit")->assertOk()->assertJsonPath('data.status', 'submitted');
        $this->assertNotContains($this->readerBookId($id), $this->listedIds());
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->admin->id, 'category' => 'reader', 'title' => 'Ebook mitra menunggu persetujuan']);

        // Terkunci selama diajukan.
        $this->putJson("/api/v1/partner/books/{$id}", ['title' => 'Ubah'])->assertStatus(422);

        // Admin menolak dengan catatan (wajib).
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/partner-books/{$id}/reject", [])->assertStatus(422);
        $this->postJson("/api/v1/admin/reader/partner-books/{$id}/reject", ['note' => 'Sampul kurang jelas'])->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->assertNotContains($this->readerBookId($id), $this->listedIds());

        // Mitra memperbaiki sesuai catatan, mengajukan ulang, admin menyetujui.
        Sanctum::actingAs($this->mitra);
        $this->getJson("/api/v1/partner/books/{$id}")->assertJsonPath('data.note', 'Sampul kurang jelas');
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->mitra->id, 'title' => 'Ebook ditolak, mohon diperbaiki']);
        $this->putJson("/api/v1/partner/books/{$id}", ['front_cover' => 'https://example.com/baru.jpg'])->assertOk();
        $this->postJson("/api/v1/partner/books/{$id}/submit")->assertOk();
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->admin->id, 'title' => 'Ebook mitra diajukan ulang']);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/partner-books/{$id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertContains($this->readerBookId($id), $this->listedIds());
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->author->id, 'title' => 'Buku Anda tayang di Tartila Book']);

        // Ditarik kembali untuk revisi: hilang dari katalog.
        Sanctum::actingAs($this->mitra);
        $this->postJson("/api/v1/partner/books/{$id}/reopen")->assertOk()->assertJsonPath('data.status', 'draft');
        $this->assertNotContains($this->readerBookId($id), $this->listedIds());
    }

    public function test_partner_books_never_appear_in_tartila_press(): void
    {
        $id = $this->completeDraft();
        $this->postJson("/api/v1/partner/books/{$id}/submit")->assertOk();
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/partner-books/{$id}/approve")->assertOk();

        $this->assertSame(0, Book::count());
        $this->assertSame(1, Book::withoutGlobalScopes()->count());
        $this->getJson('/api/v1/books')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_mitra_is_just_a_buyer_on_tartila_press(): void
    {
        Sanctum::actingAs($this->mitra);

        $this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => 1])->assertForbidden();
        $this->postJson('/api/v1/role-requests', ['requested_role' => 'penulis'])->assertForbidden();
        $this->postJson('/api/v1/events/apa-saja/register')->assertForbidden();

        // Pesanan buku fisik tidak dihalangi (gagal di validasi data, bukan 403).
        $this->assertNotSame(403, $this->postJson('/api/v1/orders', ['type' => 'book'])->status());
    }

    public function test_the_split_is_20_30_50_for_purchases_and_10_15_75_for_reads(): void
    {
        $id = $this->completeDraft();
        $this->postJson("/api/v1/partner/books/{$id}/submit")->assertOk();
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/reader/partner-books/{$id}/approve")->assertOk();

        $readerBook = ReaderBook::findOrFail($this->readerBookId($id));
        $readerBook->forceFill(['read_fee' => 200, 'read_events' => 10])->save();
        DB::table('reader_daily_reads')->insert(['reader_book_id' => $readerBook->id, 'read_date' => now('Asia/Jakarta')->toDateString(), 'events' => 10]);
        ReaderOrder::create(['order_number' => 'ORD-20261101-001EB', 'user_id' => $this->makeUser(['user'], 'Pembeli')->id, 'kind' => 'book', 'reader_book_id' => $readerBook->id, 'title' => 'Buku Mitra', 'amount' => 100000, 'status' => 'confirmed', 'confirmed_at' => now()]);

        $row = app(ReaderRoyaltyService::class)->report('2026-01-01', '2036-01-01', null, [$id])->first();

        // Pembelian: 100.000 -> penulis 50.000 + mitra 30.000 (Tartila 20.000).
        $this->assertEquals(80000, $row['purchase_royalty']);
        // Bacaan: 10 x 200 = 2.000 dari kolam bacaan -> 90% dibagikan (penulis 1.500 + mitra 300).
        $this->assertEquals(1800, $row['read_royalty']);

        $amounts = collect($row['authors'])->keyBy('user_id')->map(fn ($item) => (float) $item['amount']);
        $this->assertEquals(50000 + 1500, $amounts[$this->author->id]);
        $this->assertEquals(30000 + 300, $amounts[$this->mitra->id]);

        // Masuk dompet masing-masing, dan penulis/mitra bisa melihatnya.
        $wallet = app(WalletService::class);
        $this->assertEquals(51500, $wallet->summary($this->author)['by_type']['ebook_royalty']);
        $this->assertEquals(30300, $wallet->summary($this->mitra)['by_type']['ebook_royalty']);

        Sanctum::actingAs($this->mitra);
        $this->getJson('/api/v1/partner/report?from=2026-01-01&to=2036-01-01')->assertOk()->assertJsonPath('data.total', 30300);
    }

    public function test_a_mitra_cannot_touch_another_mitras_book(): void
    {
        $id = $this->completeDraft();

        $other = $this->makeUser(['mitra'], 'Mitra Lain');
        Partner::create(['user_id' => $other->id, 'company_name' => 'Lain', 'is_active' => true]);

        Sanctum::actingAs($other);
        $this->getJson("/api/v1/partner/books/{$id}")->assertNotFound();
        $this->postJson("/api/v1/partner/books/{$id}/submit")->assertNotFound();
        $this->getJson("/api/v1/partner/books/{$id}/documents/mou")->assertNotFound();
    }

    private function readerBookId(int $bookId): int
    {
        return (int) PartnerBookService::find($bookId)->readerBook->id;
    }
}
