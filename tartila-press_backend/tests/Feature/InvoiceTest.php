<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\Order;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Invoice setelah pesan + batas bayar 1×24 jam (pesanan dibatalkan otomatis). */
class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private PaymentMethod $bni;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
        $this->bni = PaymentMethod::create(['bank_name' => 'BNI', 'account_number' => '0123456789', 'account_holder_name' => 'Tartila Press', 'is_active' => true]);
    }

    private function makeUser(array $roles = ['user'], string $name = 'Pembeli'): User
    {
        $user = User::create(['name' => $name, 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->markEmailAsVerified();
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function orderPackage(User $buyer, array $extra = []): TestResponse
    {
        $package = Package::create(['name' => 'Paket Terbit Cepat', 'price' => 1500000, 'discount' => 0, 'created_by' => $this->admin->id]);
        Sanctum::actingAs($buyer);

        return $this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => $package->id] + $extra);
    }

    private function proof(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('bukti.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    }

    public function test_order_gets_an_invoice_with_buyer_items_account_and_24_hour_deadline(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 7)->setTime(9, 0));
        $buyer = $this->makeUser(name: 'Siti Aminah');

        $order = Order::findOrFail($this->orderPackage($buyer, ['payment_method_id' => $this->bni->id])->assertCreated()->json('data.id'));

        $this->assertSame(sprintf('INV-20261007-%05d', $order->id), $order->invoice_number);
        $this->assertSame('2026-10-08 09:00', $order->payment_due_at->format('Y-m-d H:i'));

        $invoice = $this->getJson("/api/v1/orders/{$order->id}/invoice")->assertOk();
        $invoice->assertJsonPath('data.invoice_number', $order->invoice_number)
            ->assertJsonPath('data.buyer.name', 'Siti Aminah')
            ->assertJsonPath('data.items.0.name', 'Paket Terbit Cepat')
            ->assertJsonPath('data.total', 1500000)
            ->assertJsonPath('data.payment_method.bank_name', 'BNI')
            ->assertJsonPath('data.payment_method.account_number', '0123456789')
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.payment_window_hours', 24);

        // Orang lain tidak boleh; admin boleh.
        Sanctum::actingAs($this->makeUser());
        $this->getJson("/api/v1/orders/{$order->id}/invoice")->assertForbidden();
        Sanctum::actingAs($this->admin);
        $this->getJson("/api/v1/orders/{$order->id}/invoice")->assertOk();
    }

    public function test_an_active_account_must_be_chosen(): void
    {
        $buyer = $this->makeUser();

        $this->orderPackage($buyer)->assertUnprocessable()
            ->assertJsonPath('errors.payment_method_id.0', 'Pilih rekening tujuan pembayaran.');

        $inactive = PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '9', 'account_holder_name' => 'X', 'is_active' => false]);
        $this->orderPackage($buyer, ['payment_method_id' => $inactive->id])->assertUnprocessable();
    }

    public function test_unpaid_orders_are_cancelled_after_24_hours_and_paid_ones_are_kept(): void
    {
        $buyer = $this->makeUser();

        $project = Book::create(['title' => 'Proyek', 'price' => 50000, 'discount' => 0, 'is_active' => true, 'is_chapter_offering' => true, 'created_by' => $this->admin->id]);
        $chapter = BookChapter::create(['book_id' => $project->id, 'chapter_number' => 1, 'title' => 'Bab 1']);

        Sanctum::actingAs($buyer);
        $unpaid = Order::findOrFail($this->postJson('/api/v1/orders', ['type' => 'book_chapter', 'book_chapter_id' => $chapter->id, 'payment_method_id' => $this->bni->id])->assertCreated()->json('data.id'));
        $this->assertSame($unpaid->id, $chapter->fresh()->order_id);

        $withProof = Order::findOrFail($this->orderPackage($buyer, ['payment_method_id' => $this->bni->id])->json('data.id'));
        $this->post("/api/v1/orders/{$withProof->id}/payment-proof", ['file' => $this->proof()], ['Accept' => 'application/json'])->assertOk();

        // Pesanan lama tanpa batas bayar tidak disentuh.
        $legacy = $this->makeOrderWithoutDeadline($buyer);

        // Penjadwal berjalan tanpa pengguna login (pelaku aksi tidak diberi notifikasi).
        $this->app['auth']->forgetGuards();

        $this->travel(23)->hours();
        $this->artisan('orders:cancel-unpaid')->expectsOutputToContain('0 pesanan dibatalkan')->assertSuccessful();

        $this->travel(2)->hours();
        $this->artisan('orders:cancel-unpaid')->expectsOutputToContain('1 pesanan dibatalkan')->assertSuccessful();

        $this->assertSame('cancelled', $unpaid->fresh()->status);
        $this->assertNull($chapter->fresh()->order_id, 'Slot bab kembali terbuka.');
        $this->assertSame(OrderStatusService::AUTO_CANCEL_NOTE, $unpaid->statusHistories()->where('event', 'order_cancelled')->value('note'));
        $this->assertTrue(UserNotification::where('user_id', $buyer->id)->where('title', "Pesanan {$unpaid->order_number} dibatalkan")->exists());
        $this->assertSame('pending', $withProof->fresh()->status);
        $this->assertSame('pending', $legacy->fresh()->status);

        Sanctum::actingAs($buyer);
        $this->getJson("/api/v1/orders/{$unpaid->id}/invoice")
            ->assertJsonPath('data.payment_status', 'cancelled')
            ->assertJsonPath('data.cancel_reason', OrderStatusService::AUTO_CANCEL_NOTE);
    }

    public function test_proof_cannot_be_uploaded_after_the_deadline(): void
    {
        $buyer = $this->makeUser();
        $order = Order::findOrFail($this->orderPackage($buyer, ['payment_method_id' => $this->bni->id])->json('data.id'));

        $this->travel(25)->hours();

        $this->post("/api/v1/orders/{$order->id}/payment-proof", ['file' => $this->proof()], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_admin_approval_uses_the_account_chosen_by_the_buyer(): void
    {
        $buyer = $this->makeUser();
        PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '222', 'account_holder_name' => 'Tartila', 'is_active' => true]);

        $order = Order::findOrFail($this->orderPackage($buyer, ['payment_method_id' => $this->bni->id])->json('data.id'));
        $this->post("/api/v1/orders/{$order->id}/payment-proof", ['file' => $this->proof()], ['Accept' => 'application/json'])->assertOk();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", ['decision' => 'approve'])->assertOk();

        $this->assertSame($this->bni->id, $order->fresh()->payment_method_id);
    }

    public function test_cancelled_paid_event_registration_can_be_made_again(): void
    {
        $buyer = $this->makeUser();
        $event = Event::create(['title' => 'Webinar', 'description' => 'Uji.', 'starts_at' => now()->addWeek(), 'fee' => 50000, 'is_active' => true, 'created_by' => $this->admin->id]);

        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/events/{$event->slug}/register", [])->assertUnprocessable();
        $first = $this->postJson("/api/v1/events/{$event->slug}/register", ['payment_method_id' => $this->bni->id])->assertCreated();
        $this->assertNotNull(Order::find($first->json('data.order.id'))->payment_due_at);

        $this->travel(25)->hours();
        $this->artisan('orders:cancel-unpaid')->assertSuccessful();
        $this->assertSame('cancelled', EventRegistration::sole()->status);

        $this->postJson("/api/v1/events/{$event->slug}/register", ['payment_method_id' => $this->bni->id])->assertCreated();
        $this->assertSame('pending', EventRegistration::sole()->status);
        $this->assertSame(2, Order::count());
    }

    private function makeOrderWithoutDeadline(User $buyer): Order
    {
        $order = Order::create(['order_number' => Order::generateOrderNumber(), 'user_id' => $buyer->id, 'status' => 'pending', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $order->forceFill(['payment_due_at' => null])->saveQuietly();

        return $order;
    }
}
