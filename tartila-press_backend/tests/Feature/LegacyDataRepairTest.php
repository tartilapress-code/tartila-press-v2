<?php

namespace Tests\Feature;

use App\Models\AboutProfile;
use App\Models\Book;
use App\Models\Event;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use App\Notifications\NoticeMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Perbaikan isu Lampiran E dokumen SRS-SDD (data lama + pencegahannya). */
class LegacyDataRepairTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roles = []): User
    {
        $user = User::create(['name' => 'Penguji '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->markEmailAsVerified();
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function makeOrder(User $buyer, string $status): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $buyer->id,
            'status' => $status,
            'subtotal' => 100000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 100000,
        ]);
    }

    private function runRepair(): void
    {
        $migration = require database_path('migrations/2026_10_20_090100_repair_legacy_order_and_account_data.php');
        $migration->up();
    }

    public function test_repair_backfills_paid_history_roles_and_orphan_tokens(): void
    {
        $buyer = $this->makeUser(['user']);

        $legacyPaid = $this->makeOrder($buyer, 'confirmed');
        DB::table('orders')->where('id', $legacyPaid->id)->update(['updated_at' => '2026-09-13 10:11:25']);

        $legacyDone = $this->makeOrder($buyer, 'completed');
        DB::table('orders')->where('id', $legacyDone->id)->update(['updated_at' => '2026-09-23 09:00:00']);
        DB::table('order_status_histories')->insert(['order_id' => $legacyDone->id, 'event' => 'order_completed', 'created_at' => '2026-09-23 07:35:05', 'updated_at' => '2026-09-23 07:35:05']);

        $pending = $this->makeOrder($buyer, 'pending');
        $modern = $this->makeOrder($buyer, 'confirmed');
        $modern->logStatusHistory('payment_confirmed');

        $roleless = User::create(['name' => 'Tanpa Peran', 'email' => 'tanpa@example.com', 'password' => 'Tartila@2026']);

        $buyer->createToken('masih-dipakai');
        DB::table('personal_access_tokens')->insert([
            'tokenable_type' => User::class, 'tokenable_id' => 9999, 'name' => 'yatim',
            'token' => hash('sha256', 'yatim'), 'abilities' => '["*"]', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->runRepair();
        $this->runRepair(); // aman dijalankan ulang

        $paidAt = fn (Order $order) => DB::table('order_status_histories')->where('order_id', $order->id)->where('event', 'payment_confirmed')->pluck('created_at')->all();
        $this->assertSame(['2026-09-13 10:11:25'], $paidAt($legacyPaid));
        $this->assertSame(['2026-09-23 07:35:05'], $paidAt($legacyDone));
        $this->assertSame([], $paidAt($pending));
        $this->assertCount(1, $paidAt($modern));

        $this->assertSame(['user'], $roleless->roles()->pluck('name')->all());
        $this->assertSame(['user'], $buyer->roles()->pluck('name')->all());

        $this->assertSame(1, DB::table('personal_access_tokens')->count());
        $this->assertSame(1, $buyer->tokens()->count());
    }

    public function test_completing_an_order_directly_still_records_payment(): void
    {
        $admin = $this->makeUser(['admin']);
        $order = $this->makeOrder($this->makeUser(['user']), 'pending');

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", ['status' => 'completed'])->assertOk();
        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", ['status' => 'completed'])->assertOk();

        $this->assertSame(1, $order->statusHistories()->where('event', 'payment_confirmed')->count());
    }

    public function test_deleting_a_user_removes_their_login_tokens(): void
    {
        $user = $this->makeUser(['user']);
        $user->createToken('login');
        $other = $this->makeUser(['user']);
        $other->createToken('login');

        $user->delete();

        $this->assertSame(0, DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->count());
        $this->assertSame(1, $other->tokens()->count());
    }

    public function test_deleting_the_creating_admin_keeps_books_packages_and_events(): void
    {
        $admin = $this->makeUser(['admin']);

        $book = Book::create(['title' => 'Buku Tetap', 'price' => 100000, 'discount' => 0, 'is_active' => true, 'created_by' => $admin->id]);
        $package = Package::create(['name' => 'Paket Tetap', 'price' => 1500000, 'discount' => 0, 'created_by' => $admin->id]);
        $event = Event::create(['title' => 'Event Tetap', 'description' => 'Uji.', 'starts_at' => now()->addWeek(), 'fee' => 0, 'created_by' => $admin->id]);

        $admin->delete();

        $this->assertNull($book->fresh()->created_by);
        $this->assertNull($package->fresh()->created_by);
        $this->assertNull($event->fresh()->created_by);
    }

    public function test_office_email_falls_back_to_the_about_page_contact(): void
    {
        Notification::fake();
        config(['app.order_notification_email' => null]);
        AboutProfile::current()->update(['contact_email' => 'kantor@example.com']);

        $admin = $this->makeUser(['admin']);
        $package = Package::create(['name' => 'Paket Uji', 'price' => 1500000, 'discount' => 0, 'created_by' => $admin->id]);

        Sanctum::actingAs($this->makeUser(['user']));
        $this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => $package->id])->assertCreated();

        Notification::assertSentOnDemand(NoticeMail::class, fn (NoticeMail $mail, array $channels, AnonymousNotifiable $notifiable) => $notifiable->routes['mail'] === 'kantor@example.com');
    }
}
