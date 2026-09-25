<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Order;
use App\Models\Package;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookShipmentTest extends TestCase
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
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
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

    private function makeConfirmedBookOrder(User $buyer, Book $book): Order
    {
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes No. 1',
        ]);

        $order = Order::findOrFail($response->json('data.id'));
        $order->update(['status' => 'confirmed']);
        $order->bookShipment()->update(['status' => 'confirmed']);

        return $order->fresh();
    }

    /*
    |--------------------------------------------------------------------------
    | Checkout - Alamat Pengiriman
    |--------------------------------------------------------------------------
    */

    public function test_book_order_uses_explicit_recipient_details(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Budi Pembeli',
            'recipient_phone' => '081200000000',
            'recipient_address' => 'Jl. Baru No. 99',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.book_shipment.recipient_name', 'Budi Pembeli');
        $response->assertJsonPath('data.book_shipment.recipient_phone', '081200000000');
        $response->assertJsonPath('data.book_shipment.recipient_address', 'Jl. Baru No. 99');
        $response->assertJsonPath('data.book_shipment.status', 'pending');

        $this->assertDatabaseHas('book_shipments', [
            'order_id' => $response->json('data.id'),
            'recipient_name' => 'Budi Pembeli',
        ]);
    }

    public function test_book_order_falls_back_to_profile_data_when_fields_omitted(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        PersonalProfile::create([
            'user_id' => $buyer->id,
            'phone' => '089988887777',
            'domicile_address' => 'Jl. Domisili No. 5',
        ]);

        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.book_shipment.recipient_name', $buyer->name);
        $response->assertJsonPath('data.book_shipment.recipient_phone', '089988887777');
        $response->assertJsonPath('data.book_shipment.recipient_address', 'Jl. Domisili No. 5');
    }

    public function test_book_order_rejected_when_address_missing_and_profile_incomplete(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('orders', ['user_id' => $buyer->id]);
        $this->assertDatabaseCount('book_shipments', 0);
    }

    public function test_non_book_orders_do_not_create_a_shipment(): void
    {
        $admin = $this->makeUser(['admin']);
        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 500000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);
        $this->assertNull($response->json('data.book_shipment'));
        $this->assertDatabaseCount('book_shipments', 0);
    }

    /*
    |--------------------------------------------------------------------------
    | Sinkronisasi Status Order <-> Shipment
    |--------------------------------------------------------------------------
    */

    public function test_admin_confirming_book_order_advances_shipment_to_confirmed(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'A',
            'recipient_phone' => '0800000000',
            'recipient_address' => 'Alamat A',
        ])->json('data.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->patchJson("/api/v1/admin/orders/{$orderId}/status", [
            'status' => 'confirmed',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.book_shipment.status', 'confirmed');
    }

    public function test_admin_confirming_non_book_order_does_not_error(): void
    {
        $admin = $this->makeUser(['admin']);
        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 500000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ])->json('data.id');

        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/orders/{$orderId}/status", [
            'status' => 'confirmed',
        ])->assertStatus(200);
    }

    public function test_admin_setting_order_completed_marks_shipment_delivered(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'completed',
        ])->assertStatus(200);

        $this->assertDatabaseHas('book_shipments', [
            'order_id' => $order->id,
            'status' => 'delivered',
            'delivery_confirmed_by' => 'admin',
        ]);
    }

    public function test_admin_setting_order_cancelled_marks_shipment_cancelled(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'cancelled',
        ])->assertStatus(200);

        $this->assertDatabaseHas('book_shipments', [
            'order_id' => $order->id,
            'status' => 'cancelled',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - Progres Pengiriman
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_advance_shipment_progress_and_set_estimated_arrival(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $shipmentId = $order->bookShipment->id;

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->patchJson("/api/v1/admin/book-shipments/{$shipmentId}", [
            'status' => 'printing',
            'estimated_arrival_date' => '2026-10-01',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'printing');
        $response->assertJsonPath('data.estimated_arrival_date', '2026-10-01T00:00:00.000000Z');
    }

    public function test_admin_cannot_advance_shipment_before_order_confirmed(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'A',
            'recipient_phone' => '0800000000',
            'recipient_address' => 'Alamat A',
        ])->json('data.id');

        $shipmentId = Order::find($orderId)->bookShipment->id;

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/book-shipments/{$shipmentId}", [
            'status' => 'printing',
        ])->assertStatus(422);
    }

    public function test_admin_cannot_update_a_cancelled_shipment(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $order->bookShipment->update(['status' => 'cancelled']);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/book-shipments/{$order->bookShipment->id}", [
            'status' => 'printing',
        ])->assertStatus(422);
    }

    public function test_non_admin_cannot_update_book_shipment(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);

        Sanctum::actingAs($buyer);

        $this->patchJson("/api/v1/admin/book-shipments/{$order->bookShipment->id}", [
            'status' => 'printing',
        ])->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | User - Konfirmasi Barang Sampai
    |--------------------------------------------------------------------------
    */

    public function test_user_can_confirm_shipment_received(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $order->bookShipment->update([
            'status' => 'awaiting_confirmation',
            'awaiting_confirmation_at' => now(),
        ]);

        Sanctum::actingAs($buyer);

        $response = $this->postJson("/api/v1/orders/{$order->id}/confirm-received");

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'completed');
        $response->assertJsonPath('data.book_shipment.status', 'delivered');
        $response->assertJsonPath('data.book_shipment.delivery_confirmed_by', 'user');
    }

    public function test_user_cannot_confirm_someone_elses_shipment(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $order->bookShipment->update([
            'status' => 'awaiting_confirmation',
            'awaiting_confirmation_at' => now(),
        ]);

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->postJson("/api/v1/orders/{$order->id}/confirm-received")
            ->assertStatus(403);
    }

    public function test_user_cannot_confirm_when_not_awaiting_confirmation(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);

        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/orders/{$order->id}/confirm-received")
            ->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Auto-Confirm Command
    |--------------------------------------------------------------------------
    */

    public function test_auto_confirm_command_marks_old_awaiting_confirmation_delivered(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $order->bookShipment->update([
            'status' => 'awaiting_confirmation',
            'awaiting_confirmation_at' => now()->subDays(3),
        ]);

        $this->artisan('book-shipments:auto-confirm-delivery')->assertSuccessful();

        $this->assertDatabaseHas('book_shipments', [
            'id' => $order->bookShipment->id,
            'status' => 'delivered',
            'delivery_confirmed_by' => 'auto',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'completed',
        ]);
    }

    public function test_auto_confirm_command_does_not_touch_recent_awaiting_confirmation(): void
    {
        $book = $this->makeBook();
        $buyer = $this->makeUser();
        $order = $this->makeConfirmedBookOrder($buyer, $book);
        $order->bookShipment->update([
            'status' => 'awaiting_confirmation',
            'awaiting_confirmation_at' => now()->subHours(2),
        ]);

        $this->artisan('book-shipments:auto-confirm-delivery')->assertSuccessful();

        $this->assertDatabaseHas('book_shipments', [
            'id' => $order->bookShipment->id,
            'status' => 'awaiting_confirmation',
        ]);
    }
}
