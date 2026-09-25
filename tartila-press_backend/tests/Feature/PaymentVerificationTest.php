<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Order;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

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

    private function makePackage(array $overrides = []): Package
    {
        $admin = $this->makeUser(['admin']);

        return Package::create(array_merge([
            'name' => 'Paket Test',
            'price' => 500000,
            'discount' => 0,
            'created_by' => $admin->id,
        ], $overrides));
    }

    private function fakeImage(string $name = 'bukti.jpg'): UploadedFile
    {
        $onePixelPng = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        );

        return UploadedFile::fake()->createWithContent($name, $onePixelPng);
    }

    private function makePendingOrder(User $buyer): Order
    {
        $package = $this->makePackage();
        Sanctum::actingAs($buyer);

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ])->json('data.id');

        return Order::findOrFail($orderId);
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Methods - Admin CRUD
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_payment_method(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/payment-methods', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder_name' => 'Tartila Press',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('payment_methods', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
        ]);
    }

    public function test_non_admin_cannot_create_payment_method(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/payment-methods', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder_name' => 'Tartila Press',
        ])->assertStatus(403);
    }

    public function test_public_index_only_lists_active_payment_methods(): void
    {
        PaymentMethod::create([
            'bank_name' => 'BCA',
            'account_number' => '111',
            'account_holder_name' => 'Tartila Press',
            'is_active' => true,
        ]);
        PaymentMethod::create([
            'bank_name' => 'Mandiri (Nonaktif)',
            'account_number' => '222',
            'account_holder_name' => 'Tartila Press',
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/payment-methods');

        $names = collect($response->json('data'))->pluck('bank_name');
        $this->assertTrue($names->contains('BCA'));
        $this->assertFalse($names->contains('Mandiri (Nonaktif)'));
    }

    public function test_admin_can_update_and_delete_payment_method(): void
    {
        $method = PaymentMethod::create([
            'bank_name' => 'BCA',
            'account_number' => '111',
            'account_holder_name' => 'Tartila Press',
        ]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/payment-methods/{$method->id}", [
            'is_active' => false,
        ])->assertStatus(200);

        $this->assertDatabaseHas('payment_methods', [
            'id' => $method->id,
            'is_active' => false,
        ]);

        $this->deleteJson("/api/v1/admin/payment-methods/{$method->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('payment_methods', ['id' => $method->id]);
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Bukti Transfer
    |--------------------------------------------------------------------------
    */

    public function test_buyer_can_upload_payment_proof_for_own_pending_order(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);

        $response = $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ]);

        $response->assertStatus(200);
        $this->assertNotNull($response->json('data.payment_proof_url'));

        $order->refresh();
        $this->assertNotNull($order->payment_proof_file);
        $this->assertNotNull($order->payment_proof_uploaded_at);
        Storage::disk('public')->assertExists($order->payment_proof_file);
    }

    public function test_cannot_upload_payment_proof_for_someone_elses_order(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ])->assertStatus(403);
    }

    public function test_cannot_upload_payment_proof_for_a_non_pending_order(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);
        $order->update(['status' => 'confirmed']);

        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ])->assertStatus(422);
    }

    public function test_upload_rejects_non_image_proof(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf'),
        ])->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Verifikasi Admin
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_approve_payment_and_order_becomes_confirmed(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'confirmed');
    }

    public function test_admin_can_reject_payment_with_note_and_order_becomes_cancelled(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'reject',
            'note' => 'Nominal transfer tidak sesuai.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'cancelled',
            'payment_verification_note' => 'Nominal transfer tidak sesuai.',
        ]);
    }

    public function test_admin_cannot_verify_payment_without_uploaded_proof(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(422);
    }

    public function test_admin_cannot_verify_an_already_verified_order(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(200);

        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(422);
    }

    public function test_non_admin_cannot_verify_payment(): void
    {
        $buyer = $this->makeUser();
        $order = $this->makePendingOrder($buyer);

        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(403);
    }

    public function test_approving_payment_for_a_book_order_still_syncs_shipment_status(): void
    {
        $admin = $this->makeUser(['admin']);
        $book = Book::create([
            'title' => 'Buku Test',
            'price' => 100000,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        $buyer = $this->makeUser();
        Sanctum::actingAs($buyer);

        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Penerima',
            'recipient_phone' => '0812',
            'recipient_address' => 'Jl. Tes',
        ])->json('data.id');

        $this->postJson("/api/v1/orders/{$orderId}/payment-proof", [
            'file' => $this->fakeImage(),
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/orders/{$orderId}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(200);

        $this->assertDatabaseHas('book_shipments', [
            'order_id' => $orderId,
            'status' => 'confirmed',
        ]);
    }
}
