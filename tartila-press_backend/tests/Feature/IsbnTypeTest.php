<?php

namespace Tests\Feature;

use App\Models\BookChapterSetting;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Mou;
use App\Models\MouTemplate;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Jenis ISBN (cetak / digital / keduanya): harga paket, pesanan, Book Chapter, MOU dan royalti. */
class IsbnTypeTest extends TestCase
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

        $this->admin = $this->makeUser(['admin']);
    }

    private function makeUser(array $roles = ['user']): User
    {
        $user = User::create(['name' => 'U '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));
        PersonalProfile::create(['user_id' => $user->id, 'nik' => '2171000000000001', 'ktp_address' => 'Jl. Contoh', 'phone' => '0812']);

        return $user;
    }

    private function package(array $attributes = []): Package
    {
        return Package::create($attributes + [
            'name' => 'Paket Emas', 'price' => 1000000, 'discount' => 10, 'is_active' => true, 'created_by' => $this->admin->id,
            'facilities' => ['Sampul buku', 'Layout isi'], 'services' => ['Editing naskah'],
        ]);
    }

    private function paymentMethod(): PaymentMethod
    {
        return PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '1', 'account_holder_name' => 'T', 'is_active' => true]);
    }

    // ------------------------------------------------------------------ paket

    public function test_admin_sets_prices_per_isbn_type_and_the_default_price_is_the_print_price(): void
    {
        Sanctum::actingAs($this->admin);

        $created = $this->postJson('/api/v1/admin/packages', [
            'name' => 'Paket Perak', 'discount' => 10,
            'isbn_prices' => ['print' => 1000000, 'electronic' => 800000, 'both' => 1500000],
        ])->assertCreated();

        $created->assertJsonPath('data.price', '1000000.00')
            ->assertJsonPath('data.default_isbn_type', 'print')
            ->assertJsonPath('data.isbn_options.1.type', 'electronic')
            ->assertJsonPath('data.isbn_options.1.final_price', 720000);

        // Tanpa ISBN cetak: harga bawaan = jenis pertama yang ditawarkan.
        $this->postJson('/api/v1/admin/packages', ['name' => 'Paket Digital', 'isbn_prices' => ['electronic' => 700000]])->assertCreated()
            ->assertJsonPath('data.price', '700000.00')
            ->assertJsonPath('data.default_isbn_type', 'electronic');

        // Wajib memilih minimal satu jenis ISBN (atau mengirim harga lama).
        $this->postJson('/api/v1/admin/packages', ['name' => 'Kosong', 'isbn_prices' => ['print' => null]])->assertStatus(422);
        $this->postJson('/api/v1/admin/packages', ['name' => 'Tanpa harga'])->assertStatus(422);

        // Permintaan lama (hanya price) = harga ISBN cetak; jenis lain tetap.
        $id = $created->json('data.id');
        $this->patchJson("/api/v1/admin/packages/{$id}", ['price' => 1200000])->assertOk()
            ->assertJsonPath('data.isbn_prices.print', 1200000)
            ->assertJsonPath('data.isbn_prices.electronic', 800000);

        // Katalog publik menampilkan semua pilihan; harga yang tampil = ISBN cetak.
        $this->getJson("/api/v1/packages/{$id}")->assertOk()->assertJsonCount(3, 'data.isbn_options');
    }

    public function test_package_order_requires_choosing_an_isbn_type_and_uses_its_price(): void
    {
        $package = $this->package(['isbn_prices' => ['print' => 1000000, 'electronic' => 800000, 'both' => 1500000]]);
        $method = $this->paymentMethod();
        Sanctum::actingAs($this->makeUser());

        $order = ['type' => 'package', 'package_id' => $package->id, 'payment_method_id' => $method->id];

        // Belum memilih: ditolak dengan kode yang dipakai frontend untuk memunculkan pilihan.
        $this->postJson('/api/v1/orders', $order)->assertStatus(422)
            ->assertJsonPath('code', 'isbn_type_required')
            ->assertJsonCount(3, 'isbn_options');
        $this->postJson('/api/v1/orders', $order + ['isbn_type' => 'unknown'])->assertStatus(422);

        // Jenis digital: harga digital (diskon 10%) tersimpan di pesanan beserta jenisnya.
        $created = $this->postJson('/api/v1/orders', $order + ['isbn_type' => 'electronic'])->assertCreated();
        $this->assertEquals(720000, $created->json('data.total'));
        $this->assertSame('electronic', OrderItem::first()->isbn_type);
    }

    public function test_package_with_a_single_isbn_type_does_not_ask_the_buyer_to_choose(): void
    {
        $package = $this->package(['isbn_prices' => ['both' => 1500000], 'discount' => 0]);
        $method = $this->paymentMethod();
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => $package->id, 'payment_method_id' => $method->id])->assertCreated();
        $this->assertSame('both', OrderItem::first()->isbn_type);
    }

    // ------------------------------------------------------------------ Book Chapter

    private function chapterPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Antologi', 'price' => 400000, 'discount' => 0,
            'chapters' => [['title' => 'Bab 1'], ['title' => 'Bab 2'], ['title' => 'Bab 3']],
        ], $overrides);
    }

    public function test_book_chapter_minimum_cost_depends_on_the_isbn_type_and_the_editor_must_choose_one(): void
    {
        BookChapterSetting::current()->update([
            'isbn_print_cost' => 100000, 'isbn_electronic_cost' => 50000,
            'min_book_cost_print' => 1000000, 'min_book_cost_electronic' => 1100000, 'min_book_cost_both' => 1500000,
        ]);

        $editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 0, 'is_available' => true]);
        Sanctum::actingAs($editor);

        // Wajib memilih jenis ISBN.
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->chapterPayload())->assertStatus(422)->assertJsonValidationErrors('isbn_type');

        // Total 1.200.000: cetak sisa 1.100.000 >= 1.000.000 lolos; digital sisa 1.150.000 >= 1.100.000 lolos;
        // keduanya sisa 1.050.000 < 1.500.000 ditolak.
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->chapterPayload(['isbn_type' => 'print']))->assertCreated()
            ->assertJsonPath('data.isbn_type', 'print')
            ->assertJsonPath('data.includes_isbn_print', true)
            ->assertJsonPath('data.includes_isbn_electronic', false)
            ->assertJsonPath('data.cost_summary.min_book_cost', 1000000);

        $this->postJson('/api/v1/editor/book-chapter-projects', $this->chapterPayload(['isbn_type' => 'electronic']))->assertCreated()
            ->assertJsonPath('data.cost_summary.min_book_cost', 1100000);

        $this->postJson('/api/v1/editor/book-chapter-projects', $this->chapterPayload(['isbn_type' => 'both']))->assertStatus(422);
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->chapterPayload(['isbn_type' => 'both', 'price' => 600000]))->assertCreated()
            ->assertJsonPath('data.includes_isbn_print', true)
            ->assertJsonPath('data.includes_isbn_electronic', true);
    }

    public function test_admin_manages_the_minimum_cost_per_isbn_type_and_the_public_list_filters_by_it(): void
    {
        Sanctum::actingAs($this->admin);

        $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 2, 'min_price' => 0, 'max_discount' => 100,
            'min_book_cost' => 10, 'min_book_cost_print' => 1000, 'min_book_cost_electronic' => 500, 'min_book_cost_both' => 1500,
        ])->assertOk()
            ->assertJsonPath('data.min_book_cost_print', '1000.00')
            ->assertJsonPath('data.min_book_cost_both', '1500.00');

        $this->postJson('/api/v1/admin/book-chapter-projects', $this->chapterPayload(['title' => 'Cetak Saja', 'isbn_type' => 'print']))->assertCreated();
        $this->postJson('/api/v1/admin/book-chapter-projects', $this->chapterPayload(['title' => 'Digital Saja', 'isbn_type' => 'electronic']))->assertCreated();

        // Pencarian menurut jenis ISBN; pengguna melihat jenisnya dengan jelas.
        $all = $this->getJson('/api/v1/book-chapter-projects')->assertOk();
        $this->assertEqualsCanonicalizing(['print', 'electronic'], array_column($all->json('data'), 'isbn_type'));

        $this->getJson('/api/v1/book-chapter-projects?isbn_type=electronic')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Digital Saja');
    }

    // ------------------------------------------------------------------ MOU & royalti

    private function manuscriptFromPackage(string $isbnType): Manuscript
    {
        $author = $this->makeUser(['penulis']);
        $package = $this->package(['isbn_prices' => ['print' => 1000000, 'electronic' => 800000, 'both' => 1500000]]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        OrderItem::create([
            'order_id' => $order->id, 'itemable_type' => Package::class, 'itemable_id' => $package->id, 'name' => $package->name,
            'isbn_type' => $isbnType, 'quantity' => 1, 'unit_price' => 1, 'subtotal' => 1,
        ]);

        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $author->id, 'title' => 'Buku Paket', 'authors' => [$author->name], 'status' => 'pending_penulis_review']);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $author->id, 'position' => 1, 'approved_at' => now()]);
        $manuscript->update(['status' => 'completed']);

        return $manuscript;
    }

    public function test_mou_royalty_types_follow_the_isbn_type_and_state_the_package_rights(): void
    {
        $cases = ['print' => [true, false], 'electronic' => [false, true], 'both' => [true, true]];

        foreach ($cases as $type => [$physical, $ebook]) {
            $mou = Mou::where('manuscript_id', $this->manuscriptFromPackage($type)->id)->firstOrFail();

            $this->assertSame(['physical' => $physical, 'ebook' => $ebook], $mou->content['royalty_types'], $type);
            $this->assertSame($type, $mou->content['package_rights']['isbn_type']);
            $this->assertSame(['Sampul buku', 'Layout isi'], $mou->content['package_rights']['facilities']);
            $this->assertSame(['Editing naskah'], $mou->content['package_rights']['services']);
            $this->assertSame('Paket Emas', $mou->content['package_rights']['package']);
        }
    }

    public function test_the_published_book_keeps_the_isbn_type_of_the_package(): void
    {
        $manuscript = $this->manuscriptFromPackage('electronic');
        $mou = Mou::where('manuscript_id', $manuscript->id)->firstOrFail();
        $mou->forceFill(['status' => Mou::STATUS_SIGNED])->save();
        $mou->signatories()->update(['signed_at' => now()]);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/books/from-manuscript/{$manuscript->id}", ['price' => 50000])
            ->assertCreated()
            ->assertJsonPath('data.isbn_type', 'electronic')
            ->assertJsonPath('data.includes_isbn_print', false)
            ->assertJsonPath('data.includes_isbn_electronic', true);
    }

    public function test_distribution_options_are_stored_as_a_list_of_points(): void
    {
        Sanctum::actingAs($this->admin);
        $template = MouTemplate::current('regular');

        $this->putJson('/api/v1/admin/mou-templates/regular', [
            'title' => $template->title, 'opening' => $template->opening, 'distribution_mode' => 'one',
            'first_party_terms' => $template->first_party_terms, 'second_party_terms' => $template->second_party_terms,
            'closing_terms' => $template->closing_terms, 'contact_note' => $template->contact_note,
            'physical_royalty' => 25, 'ebook_royalty' => 25,
            'distribution_options' => [['name' => 'Hak Eksklusif', 'points' => ['Distribusi hanya oleh Pihak Pertama.', '  ', 'Pihak Kedua dilarang mendistribusikan.']]],
        ])->assertOk()
            ->assertJsonPath('data.distribution_options.0.points', ['Distribusi hanya oleh Pihak Pertama.', 'Pihak Kedua dilarang mendistribusikan.']);
    }
}
