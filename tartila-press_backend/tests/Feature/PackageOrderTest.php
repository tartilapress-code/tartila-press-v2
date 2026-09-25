<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PackageOrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create([
                'name' => $name,
                'display_name' => ucfirst($name),
            ]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
    }

    private function makePackage(array $overrides = []): Package
    {
        $admin = $this->makeUser(['admin']);

        return Package::create(array_merge([
            'name' => 'Paket Konversi',
            'price' => 1000000,
            'discount' => 20,
            'facilities' => ['E-book ber-ISBN'],
            'services' => ['Estimasi terbit 7 hari'],
            'terms' => ['Karya orisinal'],
            'is_active' => true,
            'created_by' => $admin->id,
        ], $overrides));
    }

    private function makeBook(array $overrides = []): Book
    {
        $admin = $this->makeUser(['admin']);

        return Book::create(array_merge([
            'title' => 'Buku Test',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $admin->id,
        ], $overrides));
    }

    /*
    |--------------------------------------------------------------------------
    | Package CRUD
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_package(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/packages', [
            'name' => 'Paket Baru',
            'price' => 500000,
            'discount' => 10,
            'facilities' => ['Fasilitas A'],
            'services' => ['Layanan A'],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('packages', [
            'name' => 'Paket Baru',
            'created_by' => $admin->id,
        ]);
    }

    public function test_package_price_exceeding_column_limit_is_rejected(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/packages', [
            'name' => 'Paket Mahal',
            'price' => 600000000000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('price');
    }

    public function test_non_admin_cannot_create_package(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/packages', [
            'name' => 'Paket Baru',
            'price' => 500000,
        ])->assertStatus(403);
    }

    public function test_public_can_list_active_packages_only(): void
    {
        $this->makePackage(['name' => 'Aktif', 'is_active' => true]);
        $this->makePackage(['name' => 'Nonaktif', 'is_active' => false]);

        $response = $this->getJson('/api/v1/packages');

        $response->assertStatus(200);
        $names = collect($response->json('data'))->pluck('name');

        $this->assertTrue($names->contains('Aktif'));
        $this->assertFalse($names->contains('Nonaktif'));
    }

    /*
    |--------------------------------------------------------------------------
    | Custom Package Items CRUD
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_custom_item(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'facility',
            'name' => 'Desain Cover',
            'price' => 150000,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('custom_package_items', [
            'name' => 'Desain Cover',
        ]);
    }

    public function test_custom_item_price_exceeding_column_limit_is_rejected(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'facility',
            'name' => 'Item Mahal',
            'price' => 600000000000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('price');
    }

    public function test_admin_can_create_custom_item_with_discount_and_description(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $response = $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
            'discount' => 15,
            'description' => 'Penyuntingan bahasa dan ejaan oleh editor berpengalaman.',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.discount', 15);
        $response->assertJsonPath('data.final_price', 425000);
        $this->assertDatabaseHas('custom_package_items', [
            'name' => 'Editing Naskah',
            'discount' => 15,
            'description' => 'Penyuntingan bahasa dan ejaan oleh editor berpengalaman.',
        ]);
    }

    public function test_custom_item_defaults_to_no_discount(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'facility',
            'name' => 'Desain Cover',
            'price' => 150000,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.discount', 0)
            ->assertJsonPath('data.final_price', 150000);
    }

    public function test_admin_can_update_custom_item_discount_and_description(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
        ]);

        $this->patchJson("/api/v1/admin/custom-package-items/{$item->id}", [
            'discount' => 20,
            'description' => 'Sudah termasuk 2 kali revisi.',
        ])
            ->assertOk()
            ->assertJsonPath('data.discount', 20)
            ->assertJsonPath('data.final_price', 400000)
            ->assertJsonPath('data.description', 'Sudah termasuk 2 kali revisi.');

        // Diskon bisa dihapus lagi, deskripsi bisa dikosongkan.
        $this->patchJson("/api/v1/admin/custom-package-items/{$item->id}", [
            'discount' => 0,
            'description' => null,
        ])
            ->assertOk()
            ->assertJsonPath('data.discount', 0)
            ->assertJsonPath('data.final_price', 500000)
            ->assertJsonPath('data.description', null);
    }

    public function test_blank_custom_item_discount_means_no_discount(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
            'discount' => 20,
        ]);

        $this->patchJson("/api/v1/admin/custom-package-items/{$item->id}", ['discount' => null])
            ->assertOk()
            ->assertJsonPath('data.discount', 0);

        $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'facility',
            'name' => 'ISBN',
            'price' => 100000,
            'discount' => null,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.discount', 0);
    }

    public function test_custom_item_discount_must_be_a_whole_percentage(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        foreach ([101, -1, 10.5, 'banyak'] as $invalid) {
            $this->postJson('/api/v1/admin/custom-package-items', [
                'type' => 'facility',
                'name' => 'Desain Cover',
                'price' => 150000,
                'discount' => $invalid,
            ])
                ->assertStatus(422)
                ->assertJsonValidationErrors('discount');
        }

        $this->assertDatabaseCount('custom_package_items', 0);
    }

    public function test_public_custom_item_list_shows_discount_final_price_and_description(): void
    {
        CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
            'discount' => 10,
            'description' => 'Penyuntingan bahasa dan ejaan.',
        ]);
        CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Item Nonaktif',
            'price' => 100000,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/custom-package-items');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $response->assertJsonPath('data.0.name', 'Editing Naskah');
        $response->assertJsonPath('data.0.discount', 10);
        $response->assertJsonPath('data.0.final_price', 450000);
        $response->assertJsonPath('data.0.description', 'Penyuntingan bahasa dan ejaan.');
    }

    public function test_non_admin_cannot_update_custom_item(): void
    {
        Sanctum::actingAs($this->makeUser());
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
        ]);

        $this->patchJson("/api/v1/admin/custom-package-items/{$item->id}", ['discount' => 90])
            ->assertStatus(403);

        $this->assertSame(0, $item->fresh()->discount);
    }

    /*
    |--------------------------------------------------------------------------
    | Order - Beli Paket Admin
    |--------------------------------------------------------------------------
    */

    public function test_user_can_order_a_package_and_total_reflects_discount(): void
    {
        $package = $this->makePackage([
            'price' => 1000000,
            'discount' => 20,
        ]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '1000000.00');
        $response->assertJsonPath('data.discount_total', '200000.00');
        $response->assertJsonPath('data.total', '800000.00');

        $this->assertDatabaseHas('order_items', [
            'itemable_type' => Package::class,
            'itemable_id' => $package->id,
            'name' => $package->name,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Order - Rakit Paket Custom
    |--------------------------------------------------------------------------
    */

    public function test_user_can_order_a_custom_package_from_multiple_items(): void
    {
        $facility = CustomPackageItem::create([
            'type' => 'facility',
            'name' => 'Desain Cover',
            'price' => 150000,
        ]);

        $service = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 250000,
        ]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$facility->id, $service->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '400000.00');
        $response->assertJsonPath('data.discount_total', '0.00');
        $response->assertJsonPath('data.total', '400000.00');

        $this->assertSame(
            2,
            $response->json('data.items') !== null
                ? count($response->json('data.items'))
                : 0
        );
    }

    public function test_custom_package_order_applies_each_items_discount(): void
    {
        $facility = CustomPackageItem::create([
            'type' => 'facility',
            'name' => 'Desain Cover',
            'price' => 150000,
            'discount' => 10,
        ]);
        $service = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 250000,
        ]);

        Sanctum::actingAs($this->makeUser());

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$facility->id, $service->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '400000.00');
        $response->assertJsonPath('data.discount_total', '15000.00');
        $response->assertJsonPath('data.total', '385000.00');

        // Harga di baris item tetap harga normal; diskon ada di order.
        $this->assertDatabaseHas('order_items', [
            'itemable_type' => CustomPackageItem::class,
            'itemable_id' => $facility->id,
            'unit_price' => 150000,
            'subtotal' => 150000,
        ]);
    }

    public function test_custom_package_discount_and_editor_fee_combine(): void
    {
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
            'discount' => 20,
        ]);

        $editor = $this->makeUser(['editor']);
        EditorProfile::create([
            'user_id' => $editor->id,
            'fee' => 100000,
            'is_available' => true,
        ]);

        Sanctum::actingAs($this->makeUser());

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$item->id],
            'editor_id' => $editor->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '500000.00');
        $response->assertJsonPath('data.discount_total', '100000.00');
        $response->assertJsonPath('data.editor_fee', '100000.00');
        $response->assertJsonPath('data.total', '500000.00');
    }

    public function test_order_total_matches_the_displayed_final_price(): void
    {
        // Harga pecahan: pembulatan tampilan dan order harus sama.
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Item Pecahan',
            'price' => 33333.33,
            'discount' => 7,
        ]);

        Sanctum::actingAs($this->makeUser());

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$item->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.discount_total', '2333.33');
        $this->assertEqualsWithDelta(
            $item->fresh()->final_price,
            (float) $response->json('data.total'),
            0.001
        );
    }

    public function test_changing_an_items_discount_does_not_change_existing_orders(): void
    {
        $item = CustomPackageItem::create([
            'type' => 'service',
            'name' => 'Editing Naskah',
            'price' => 500000,
            'discount' => 10,
        ]);

        Sanctum::actingAs($this->makeUser());

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$item->id],
        ])->json('data.id');

        $item->update(['discount' => 50]);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'discount_total' => 50000,
            'total' => 450000,
        ]);
    }

    public function test_order_rejects_invalid_custom_item_ids(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [99999],
        ]);

        $response->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Order - Beli Buku (Keranjang)
    |--------------------------------------------------------------------------
    */

    public function test_user_can_buy_a_single_book(): void
    {
        $book = $this->makeBook(['title' => 'Embedded System', 'price' => 150000, 'discount' => 10]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes No. 1',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '150000.00');
        $response->assertJsonPath('data.discount_total', '15000.00');
        $response->assertJsonPath('data.total', '135000.00');

        $this->assertDatabaseHas('order_items', [
            'itemable_type' => Book::class,
            'itemable_id' => $book->id,
            'name' => $book->title,
        ]);
    }

    public function test_user_can_checkout_multiple_books_from_cart_in_one_order(): void
    {
        $bookA = $this->makeBook(['title' => 'Buku A', 'price' => 100000, 'discount' => 0]);
        $bookB = $this->makeBook(['title' => 'Buku B', 'price' => 200000, 'discount' => 10]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$bookA->id, $bookB->id],
            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes No. 1',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.subtotal', '300000.00');
        $response->assertJsonPath('data.discount_total', '20000.00');
        $response->assertJsonPath('data.total', '280000.00');
        $this->assertCount(2, $response->json('data.items'));
    }

    public function test_order_rejects_invalid_book_ids(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [99999],
        ])->assertStatus(422);
    }

    public function test_order_rejects_inactive_book(): void
    {
        $book = $this->makeBook(['is_active' => false]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
        ])->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Order - Pilih Editor
    |--------------------------------------------------------------------------
    */

    public function test_order_adds_editor_fee_when_editor_selected(): void
    {
        $package = $this->makePackage([
            'price' => 1000000,
            'discount' => 0,
        ]);

        $editor = $this->makeUser(['editor']);
        EditorProfile::create([
            'user_id' => $editor->id,
            'fee' => 100000,
            'is_available' => true,
        ]);

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
            'editor_id' => $editor->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.editor_fee', '100000.00');
        $response->assertJsonPath('data.total', '1100000.00');
    }

    public function test_order_rejects_non_editor_as_chosen_editor(): void
    {
        $package = $this->makePackage();
        $notEditor = $this->makeUser();

        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
            'editor_id' => $notEditor->id,
        ]);

        $response->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - Orders
    |--------------------------------------------------------------------------
    */

    public function test_non_admin_cannot_list_all_orders(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_admin_can_update_order_status(): void
    {
        $package = $this->makePackage();
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $orderResponse = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ]);

        $orderId = $orderResponse->json('data.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->patchJson(
            "/api/v1/admin/orders/{$orderId}/status",
            ['status' => 'confirmed']
        );

        $response->assertStatus(200);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'confirmed',
        ]);
    }
}
