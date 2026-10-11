<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookExternalSale;
use App\Models\CustomPackageItem;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Mou;
use App\Models\MouTemplate;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\BookRoyaltyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** MOU distribusi buku: tanda tangan semua penulis, syarat terbit, royalti, PDF. */
class MouTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

    private function makeUser(array $roles = ['penulis'], string $name = 'Penulis'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));
        PersonalProfile::create(['user_id' => $user->id, 'nik' => '2171000000000001', 'ktp_address' => 'Jl. Contoh, Batam', 'phone' => '0812']);

        return $user;
    }

    /** Naskah 2 penulis dari paket dengan ISBN cetak + ebook, baru saja selesai. */
    private function completedManuscript(User $first, User $second): Manuscript
    {
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $first->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);

        foreach (['ISBN Buku Cetak', 'ISBN Ebook'] as $name) {
            $item = CustomPackageItem::create(['name' => $name, 'type' => 'service', 'price' => 100000]);
            OrderItem::create(['order_id' => $order->id, 'itemable_type' => CustomPackageItem::class, 'itemable_id' => $item->id, 'name' => $name, 'quantity' => 1, 'unit_price' => 1, 'subtotal' => 1]);
        }

        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $first->id, 'title' => 'Buku MOU', 'authors' => [$first->name, $second->name], 'status' => 'pending_penulis_review']);

        foreach ([$first, $second] as $index => $author) {
            ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $author->id, 'position' => $index + 1, 'approved_at' => now()]);
        }

        // Naskah selesai → MOU dibuat otomatis.
        $manuscript->update(['status' => 'completed']);

        return $manuscript;
    }

    private function signIsbn(User $first, Manuscript $manuscript, array $extra): TestResponse
    {
        Sanctum::actingAs($first);
        $id = $this->postJson('/api/v1/isbn-applications', ['manuscript_id' => $manuscript->id])->assertOk()->json('data.id');

        return $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => self::SIGNATURE] + $extra);
    }

    public function test_every_author_signs_before_the_book_can_be_published(): void
    {
        $template = MouTemplate::current('regular');
        $template->update(['distribution_mode' => 'one', 'physical_royalty' => 30, 'ebook_royalty' => 40]);

        $first = $this->makeUser();
        $second = $this->makeUser();
        $manuscript = $this->completedManuscript($first, $second);
        $mou = Mou::where('manuscript_id', $manuscript->id)->firstOrFail();

        // Royalti dibagi rata; jenis royalti sesuai layanan ISBN (cetak + ebook).
        $this->assertSame([15.0, 15.0], $mou->signatories->pluck('royalty_physical')->all());
        $this->assertSame([20.0, 20.0], $mou->signatories->pluck('royalty_ebook')->all());
        $this->assertDatabaseHas('user_notifications', ['user_id' => $second->id, 'category' => 'mou', 'subject_id' => $mou->id]);

        // Penulis kedua menunggu penulis pertama memilih hak distribusi.
        Sanctum::actingAs($second);
        $this->getJson("/api/v1/manuscripts/{$manuscript->id}")->assertOk()
            ->assertJsonPath('data.mou.status_label', 'Menunggu tanda tangan penulis')
            ->assertJsonPath('data.mou.me.sign_via', 'direct');
        $this->getJson("/api/v1/mous/{$mou->id}")->assertOk()
            ->assertJsonPath('data.me.sign_via', 'direct')
            ->assertJsonPath('data.me.blocked_reason', 'Menunggu penulis pertama memilih hak distribusi dan menandatangani MOU.');
        $this->postJson("/api/v1/mous/{$mou->id}/sign", ['agreed' => true, 'signature' => self::SIGNATURE])->assertStatus(422);

        // Penulis pertama: tanda tangan lewat surat ISBN, bukan halaman MOU.
        Sanctum::actingAs($first);
        $this->postJson("/api/v1/mous/{$mou->id}/sign", ['agreed' => true, 'signature' => self::SIGNATURE])->assertStatus(422);
        $this->signIsbn($first, $manuscript, [])->assertStatus(422)->assertJsonValidationErrors('mou_agreed');
        $this->signIsbn($first, $manuscript, ['mou_agreed' => true])->assertStatus(422);
        $this->signIsbn($first, $manuscript, ['mou_agreed' => true, 'distribution_choice' => ['offline']])->assertOk()
            ->assertJsonPath('data.status', 'signed')
            ->assertJsonPath('data.mou.me.signed', true);

        $this->assertSame(['offline'], $mou->fresh()->distribution_choice);

        // Belum semua penulis → belum boleh terbit.
        Sanctum::actingAs($this->admin);
        $publish = fn () => $this->postJson("/api/v1/admin/books/from-manuscript/{$manuscript->id}", ['price' => 80000]);
        $publish()->assertStatus(422)->assertJsonPath('message', 'Semua penulis harus menandatangani MOU distribusi buku sebelum buku diterbitkan.');

        // Penulis kedua wajib mencentang "sudah dibaca dan disepakati".
        Sanctum::actingAs($second);
        $this->postJson("/api/v1/mous/{$mou->id}/sign", ['signature' => self::SIGNATURE])->assertStatus(422)->assertJsonValidationErrors('agreed');
        $this->postJson("/api/v1/mous/{$mou->id}/sign", ['agreed' => true, 'signature' => self::SIGNATURE])->assertOk()
            ->assertJsonPath('data.status', Mou::STATUS_SIGNED);

        $this->assertNotNull($mou->signatories()->where('user_id', $second->id)->value('signed_at'));
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->admin->id, 'category' => 'admin_mou']);

        // Aturan baru admin berlaku maju: MOU yang sudah ditandatangani tetap.
        $template->update(['physical_royalty' => 10]);
        Sanctum::actingAs($second);
        $this->getJson("/api/v1/mous/{$mou->id}")->assertJsonPath('data.content.royalty.physical', 30);

        Sanctum::actingAs($this->admin);
        $publish()->assertCreated();

        // Royalti mengikuti MOU: fisik 15% untuk penjualan sistem, ebook 20% untuk penjualan ebook.
        $book = $manuscript->book()->first();
        BookExternalSale::create(['book_id' => $book->id, 'marketplace_name' => 'Google Play', 'format' => 'ebook', 'original_price' => 50000, 'quantity_sold' => 2]);
        BookExternalSale::create(['book_id' => $book->id, 'marketplace_name' => 'Toko A', 'format' => 'physical', 'original_price' => 80000, 'quantity_sold' => 1]);

        $service = app(BookRoyaltyService::class);
        $book = Book::with([...BookRoyaltyService::SHARE_RELATIONS, 'externalSales', 'orderItems.order.voucher'])->find($book->id);
        $share = collect($service->shares($book))->firstWhere('user_id', $first->id);

        $this->assertSame(15.0, $share['rate']);
        $this->assertSame(20.0, $share['ebook_rate']);
        // 50.000 × 20% × 2 + 80.000 × 15% × 1
        $this->assertSame(32000.0, $service->summarize($book, $share['rate'], $first->id, $share['ebook_rate'])['external_royalty_amount']);
    }

    public function test_admin_seals_uploads_the_stamped_pdf_and_authors_can_open_it(): void
    {
        $first = $this->makeUser();
        $second = $this->makeUser();
        $manuscript = $this->completedManuscript($first, $second);
        $mou = Mou::where('manuscript_id', $manuscript->id)->firstOrFail();

        Sanctum::actingAs($this->admin);
        $this->get("/api/v1/admin/mous/{$mou->id}/pdf")->assertStatus(422);

        $this->signIsbn($first, $manuscript, ['mou_agreed' => true])->assertOk();
        Sanctum::actingAs($second);
        $this->postJson("/api/v1/mous/{$mou->id}/sign", ['agreed' => true, 'signature' => self::SIGNATURE])->assertOk();

        // MOU di Royalti Saya: tanpa tanda tangan penerbit dulu.
        $this->getJson('/api/v1/mous')->assertOk()->assertJsonPath('data.0.id', $mou->id)->assertJsonPath('data.0.mine.signed_at', fn ($value) => $value !== null);
        $authorPdf = $this->get("/api/v1/mous/{$mou->id}/pdf");
        $authorPdf->assertOk();
        $this->assertStringStartsWith('%PDF', $authorPdf->getContent());

        Sanctum::actingAs($this->admin);
        $sealed = $this->get("/api/v1/admin/mous/{$mou->id}/pdf");
        $sealed->assertOk();
        $this->assertStringStartsWith('%PDF', $sealed->getContent());

        $this->post("/api/v1/admin/mous/{$mou->id}/final", ['file' => UploadedFile::fake()->create('mou-bermeterai.pdf', 50, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.status', Mou::STATUS_COMPLETED);
        $this->assertTrue(UserNotification::where('user_id', $first->id)->where('title', 'MOU bermeterai sudah tersedia')->exists());

        // Bermeterai: tidak bisa diubah lagi (pakai adendum).
        $this->putJson("/api/v1/admin/mous/{$mou->id}", $this->customPayload($mou, [$first->id => [10, 10], $second->id => [10, 10]], true))->assertStatus(422);

        $this->post("/api/v1/admin/mous/{$mou->id}/addenda", ['title' => 'Adendum 1', 'file' => UploadedFile::fake()->create('adendum.pdf', 20, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.addenda.0.title', 'Adendum 1');

        Sanctum::actingAs($second);
        $this->getJson("/api/v1/mous/{$mou->id}")->assertJsonPath('data.has_final', true)->assertJsonPath('data.addenda.0.title', 'Adendum 1');
        $final = $this->get("/api/v1/mous/{$mou->id}/pdf")->assertOk();
        $this->assertStringContainsString('bermeterai', (string) $final->headers->get('content-disposition'));

        // Orang lain tidak bisa membuka.
        Sanctum::actingAs($this->makeUser());
        $this->getJson("/api/v1/mous/{$mou->id}")->assertForbidden();
        $this->getJson('/api/v1/admin/mous')->assertForbidden();
    }

    public function test_admin_customizes_one_mou_without_touching_the_template(): void
    {
        $first = $this->makeUser();
        $second = $this->makeUser();
        $manuscript = $this->completedManuscript($first, $second);
        $mou = Mou::where('manuscript_id', $manuscript->id)->firstOrFail();

        Sanctum::actingAs($this->admin);

        // Total royalti tidak boleh lebih dari 100%.
        $this->putJson("/api/v1/admin/mous/{$mou->id}", $this->customPayload($mou, [$first->id => [60, 10], $second->id => [50, 10]]))->assertStatus(422);

        $this->putJson("/api/v1/admin/mous/{$mou->id}", $this->customPayload($mou, [$first->id => [20, 10], $second->id => [10, 10]]))
            ->assertOk()
            ->assertJsonPath('data.customized', true)
            ->assertJsonPath('data.content.second_party_terms.0', 'Ketentuan khusus untuk judul ini.');

        $this->assertSame(25.0, MouTemplate::current('regular')->physical_royalty);
        $this->assertSame(20.0, $mou->signatories()->where('user_id', $first->id)->value('royalty_physical'));

        // Sudah ada yang tanda tangan → ubah hanya dengan membatalkan tanda tangan.
        $this->signIsbn($first, $manuscript, ['mou_agreed' => true])->assertOk();

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/mous/{$mou->id}", $this->customPayload($mou, [$first->id => [20, 10], $second->id => [10, 10]]))->assertStatus(422);
        $this->putJson("/api/v1/admin/mous/{$mou->id}", $this->customPayload($mou, [$first->id => [20, 10], $second->id => [10, 10]], true))->assertOk();
        $this->assertNull($mou->signatories()->where('user_id', $first->id)->value('signed_at'));
    }

    public function test_template_is_editable_per_category_and_previewable(): void
    {
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/v1/admin/mou-templates/chapter')->assertOk()->assertJsonPath('data.category', 'chapter');

        $payload = MouTemplate::defaults('chapter');
        $payload['physical_royalty'] = 20;
        $payload['distribution_options'][] = ['name' => 'Perpustakaan digital', 'description' => ''];

        $this->putJson('/api/v1/admin/mou-templates/chapter', $payload)->assertOk()
            ->assertJsonPath('data.physical_royalty', 20)
            ->assertJsonPath('data.distribution_options.3.key', 'perpustakaan_digital');

        $this->assertSame(25.0, MouTemplate::current('regular')->physical_royalty);

        $preview = $this->get('/api/v1/admin/mou-templates/chapter/preview');
        $preview->assertOk();
        $this->assertStringStartsWith('%PDF', $preview->getContent());

        $this->getJson('/api/v1/admin/mou-templates/lain')->assertNotFound();

        Sanctum::actingAs($this->makeUser());
        $this->putJson('/api/v1/admin/mou-templates/chapter', $payload)->assertForbidden();
    }

    /** @param  array<int, array{0: float, 1: float}>  $royalties */
    private function customPayload(Mou $mou, array $royalties, bool $reset = false): array
    {
        $content = $mou->fresh()->content;

        return [
            ...collect($content)->only(['title', 'opening', 'distribution_options', 'distribution_mode', 'first_party_terms', 'closing_terms', 'contact_note'])->all(),
            'second_party_terms' => ['Ketentuan khusus untuk judul ini.'],
            'royalty_types' => ['physical' => true, 'ebook' => true],
            'royalty_pool' => ['physical' => 30, 'ebook' => 20],
            'royalties' => collect($royalties)->map(fn ($values, $userId) => ['user_id' => $userId, 'physical' => $values[0], 'ebook' => $values[1]])->values()->all(),
            'reset_signatures' => $reset,
        ];
    }
}
