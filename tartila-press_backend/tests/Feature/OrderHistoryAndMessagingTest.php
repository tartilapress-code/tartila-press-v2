<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderHistoryAndMessagingTest extends TestCase
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

    private function fakeImage(string $name = 'bukti.jpg'): UploadedFile
    {
        $onePixelPng = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        );

        return UploadedFile::fake()->createWithContent($name, $onePixelPng);
    }

    private function placeBookOrder(User $buyer, Book $book): Order
    {
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes No. 1',
        ]);

        $response->assertStatus(201);

        return Order::findOrFail($response->json('data.id'));
    }

    private function placePackageOrder(User $buyer): Order
    {
        $admin = $this->makeUser(['admin']);
        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 500000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'package',
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);

        return Order::findOrFail($response->json('data.id'));
    }

    private function uploadProof(User $buyer, Order $order): void
    {
        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/orders/{$order->id}/payment-proof", [
            'file' => $this->fakeImage(),
        ])->assertStatus(200);
    }

    private function eventList(Order $order): array
    {
        return OrderStatusHistory::where('order_id', $order->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->pluck('event')
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Riwayat Proses
    |--------------------------------------------------------------------------
    */

    public function test_book_order_lifecycle_logs_history_in_order_with_single_completed_event(): void
    {
        $admin = $this->makeUser(['admin']);
        $buyer = $this->makeUser();
        $book = $this->makeBook();

        $order = $this->placeBookOrder($buyer, $book);
        $this->uploadProof($buyer, $order);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(200);

        $shipmentId = $order->fresh()->bookShipment->id;

        foreach (['printing', 'packing', 'shipping', 'awaiting_confirmation'] as $stage) {
            $this->patchJson("/api/v1/admin/book-shipments/{$shipmentId}", [
                'status' => $stage,
            ])->assertStatus(200);
        }

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/confirm-received")
            ->assertStatus(200);

        $events = $this->eventList($order);

        $this->assertSame([
            'order_placed',
            'payment_proof_uploaded',
            'payment_confirmed',
            'shipment_printing',
            'shipment_packing',
            'shipment_shipping',
            'shipment_awaiting_confirmation',
            'order_completed',
        ], $events);

        $this->assertSame(1, collect($events)->filter(fn ($e) => $e === 'order_completed')->count());
        $this->assertSame('completed', $order->fresh()->status);
    }

    public function test_package_order_completed_directly_by_admin_logs_single_completed_event(): void
    {
        $admin = $this->makeUser(['admin']);
        $buyer = $this->makeUser();

        $order = $this->placePackageOrder($buyer);
        $this->uploadProof($buyer, $order);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(200);

        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'completed',
        ])->assertStatus(200);

        $events = $this->eventList($order);

        $this->assertSame([
            'order_placed',
            'payment_proof_uploaded',
            'payment_confirmed',
            'order_completed',
        ], $events);
    }

    public function test_rejected_payment_logs_cancelled_with_rejection_note(): void
    {
        $admin = $this->makeUser(['admin']);
        $buyer = $this->makeUser();

        $order = $this->placePackageOrder($buyer);
        $this->uploadProof($buyer, $order);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", [
            'decision' => 'reject',
            'note' => 'Nominal transfer tidak sesuai.',
        ])->assertStatus(200);

        $cancelled = OrderStatusHistory::where('order_id', $order->id)
            ->where('event', 'order_cancelled')
            ->first();

        $this->assertNotNull($cancelled);
        $this->assertSame('Nominal transfer tidak sesuai.', $cancelled->note);
    }

    /*
    |--------------------------------------------------------------------------
    | Pesan ke Admin
    |--------------------------------------------------------------------------
    */

    public function test_order_owner_can_list_and_send_messages(): void
    {
        $buyer = $this->makeUser();
        $order = $this->placePackageOrder($buyer);

        Sanctum::actingAs($buyer);

        $this->getJson("/api/v1/orders/{$order->id}/messages")->assertStatus(200);

        $response = $this->postJson("/api/v1/orders/{$order->id}/messages", [
            'body' => 'Kapan pesanan saya diproses?',
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('data.body', 'Kapan pesanan saya diproses?');
        $response->assertJsonPath('data.is_admin', false);
    }

    public function test_admin_can_list_and_send_messages_on_any_order(): void
    {
        $admin = $this->makeUser(['admin']);
        $buyer = $this->makeUser();
        $order = $this->placePackageOrder($buyer);

        Sanctum::actingAs($admin);

        $this->getJson("/api/v1/orders/{$order->id}/messages")->assertStatus(200);

        $response = $this->postJson("/api/v1/orders/{$order->id}/messages", [
            'body' => 'Sedang kami proses ya.',
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('data.is_admin', true);
    }

    public function test_stranger_cannot_access_order_messages(): void
    {
        $stranger = $this->makeUser();
        $buyer = $this->makeUser();
        $order = $this->placePackageOrder($buyer);

        Sanctum::actingAs($stranger);

        $this->getJson("/api/v1/orders/{$order->id}/messages")->assertStatus(403);
        $this->postJson("/api/v1/orders/{$order->id}/messages", [
            'body' => 'Halo',
        ])->assertStatus(403);
    }

    public function test_cannot_send_message_once_order_completed(): void
    {
        $buyer = $this->makeUser();
        $order = $this->placePackageOrder($buyer);
        $order->update(['status' => 'completed']);

        Sanctum::actingAs($buyer);

        $this->postJson("/api/v1/orders/{$order->id}/messages", [
            'body' => 'Masih bisa kirim?',
        ])->assertStatus(422);
    }

    public function test_message_is_admin_flag_set_correctly_per_sender(): void
    {
        $admin = $this->makeUser(['admin']);
        $buyer = $this->makeUser();
        $order = $this->placePackageOrder($buyer);

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/messages", ['body' => 'Dari pembeli'])
            ->assertStatus(201);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/orders/{$order->id}/messages", ['body' => 'Dari admin'])
            ->assertStatus(201);

        $this->assertDatabaseHas('order_messages', [
            'order_id' => $order->id,
            'user_id' => $buyer->id,
            'body' => 'Dari pembeli',
            'is_admin' => false,
        ]);
        $this->assertDatabaseHas('order_messages', [
            'order_id' => $order->id,
            'user_id' => $admin->id,
            'body' => 'Dari admin',
            'is_admin' => true,
        ]);
    }
}
