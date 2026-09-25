<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventCategory;
use App\Models\EventRegistration;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventTest extends TestCase
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

    private function fakeImage(string $name = 'bukti.jpg'): UploadedFile
    {
        $onePixelPng = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        );

        return UploadedFile::fake()->createWithContent($name, $onePixelPng);
    }

    private function makeEvent(array $overrides = []): Event
    {
        $admin = $overrides['creator'] ?? $this->makeUser(['admin']);

        return Event::create([
            'title' => $overrides['title'] ?? 'Event Uji '.uniqid(),
            'description' => 'Deskripsi event uji coba.',
            'starts_at' => now()->addWeek(),
            'fee' => $overrides['fee'] ?? 0,
            'requires_document' => $overrides['requires_document'] ?? false,
            'is_active' => $overrides['is_active'] ?? true,
            'registration_deadline' => $overrides['registration_deadline'] ?? null,
            'meet_link' => $overrides['meet_link'] ?? null,
            'requires_meet_link' => $overrides['requires_meet_link'] ?? false,
            'youtube_url' => $overrides['youtube_url'] ?? null,
            'certificate_url' => $overrides['certificate_url'] ?? null,
            'created_by' => $admin->id,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin CRUD
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_event_category(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/event-categories', [
            'name' => 'Seminar',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('event_categories', ['name' => 'Seminar']);
    }

    public function test_admin_can_create_event(): void
    {
        $admin = $this->makeUser(['admin']);
        $category = EventCategory::create(['name' => 'Webinar']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/events', [
            'title' => 'Webinar Menulis Kreatif',
            'description' => 'Belajar menulis kreatif bersama praktisi.',
            'event_category_id' => $category->id,
            'starts_at' => now()->addWeek()->toDateTimeString(),
            'ends_at' => now()->addWeek()->addHours(2)->toDateTimeString(),
            'fee' => 50000,
            'requires_document' => true,
            'requires_meet_link' => true,
            'meet_link' => 'https://meet.google.com/abc-defg-hij',
            'youtube_url' => 'https://youtube.com/watch?v=abc',
            'certificate_url' => 'https://example.com/sertifikat.pdf',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.slug', 'webinar-menulis-kreatif');
        $this->assertDatabaseHas('events', ['title' => 'Webinar Menulis Kreatif']);
    }

    public function test_admin_index_reports_confirmed_registration_count(): void
    {
        $admin = $this->makeUser(['admin']);
        $event = $this->makeEvent(['fee' => 0, 'creator' => $admin]);

        EventRegistration::create([
            'event_id' => $event->id,
            'user_id' => $this->makeUser()->id,
            'status' => 'confirmed',
        ]);
        EventRegistration::create([
            'event_id' => $event->id,
            'user_id' => $this->makeUser()->id,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/v1/admin/events');

        $response->assertStatus(200);
        $this->assertSame(1, $response->json('data.0.confirmed_registrations_count'));
    }

    public function test_non_admin_cannot_create_event(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/events', [
            'title' => 'Event Ilegal',
            'starts_at' => now()->addWeek()->toDateTimeString(),
        ])->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Public listing
    |--------------------------------------------------------------------------
    */

    public function test_public_index_only_shows_active_events(): void
    {
        $this->makeEvent(['title' => 'Event Aktif', 'is_active' => true]);
        $this->makeEvent(['title' => 'Event Nonaktif', 'is_active' => false]);

        $response = $this->getJson('/api/v1/events');
        $titles = collect($response->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Event Aktif'));
        $this->assertFalse($titles->contains('Event Nonaktif'));
    }

    public function test_public_show_hides_meet_link_and_certificate(): void
    {
        $event = $this->makeEvent([
            'requires_meet_link' => true,
            'meet_link' => 'https://meet.google.com/rahasia',
            'certificate_url' => 'https://example.com/sertifikat-rahasia.pdf',
        ]);

        $response = $this->getJson("/api/v1/events/{$event->slug}");

        $response->assertStatus(200);
        $response->assertJsonMissingPath('data.meet_link');
        $response->assertJsonMissingPath('data.certificate_url');
    }

    public function test_public_pages_expose_the_youtube_link_to_guests(): void
    {
        $url = 'https://www.youtube.com/watch?v=D2oiIXJ7TgM';
        $event = $this->makeEvent(['youtube_url' => $url]);

        $this->getJson("/api/v1/events/{$event->slug}")
            ->assertOk()
            ->assertJsonPath('data.youtube_url', $url);

        $listed = collect($this->getJson('/api/v1/events')->json('data'))
            ->firstWhere('id', $event->id);

        $this->assertSame($url, $listed['youtube_url']);
    }

    /*
    |--------------------------------------------------------------------------
    | Registrasi - gratis
    |--------------------------------------------------------------------------
    */

    public function test_user_can_register_for_free_event_immediately(): void
    {
        $event = $this->makeEvent(['fee' => 0]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/events/{$event->slug}/register");

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'confirmed');
        $this->assertDatabaseHas('event_registrations', [
            'event_id' => $event->id,
            'user_id' => $user->id,
            'status' => 'confirmed',
            'order_id' => null,
        ]);
    }

    public function test_free_event_requiring_document_rejects_registration_without_one(): void
    {
        $event = $this->makeEvent(['fee' => 0, 'requires_document' => true]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/register")
            ->assertStatus(422);
    }

    public function test_free_event_requiring_document_accepts_registration_with_one(): void
    {
        $event = $this->makeEvent(['fee' => 0, 'requires_document' => true]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/events/{$event->slug}/register", [
            'document_url' => 'https://example.com/dokumen.pdf',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'confirmed');
    }

    public function test_cannot_register_twice_for_same_event(): void
    {
        $event = $this->makeEvent(['fee' => 0]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/register")->assertStatus(201);
        $this->postJson("/api/v1/events/{$event->slug}/register")->assertStatus(422);
    }

    public function test_cannot_register_after_deadline_passed(): void
    {
        $event = $this->makeEvent([
            'fee' => 0,
            'registration_deadline' => now()->subDay(),
        ]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/register")
            ->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Registrasi - berbayar, terintegrasi dengan Order
    |--------------------------------------------------------------------------
    */

    public function test_user_registering_for_paid_event_creates_pending_order(): void
    {
        $event = $this->makeEvent(['fee' => 75000]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/events/{$event->slug}/register");

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'pending');
        $orderId = $response->json('data.order_id');
        $this->assertNotNull($orderId);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'user_id' => $user->id,
            'status' => 'pending',
            'total' => 75000,
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderId,
            'itemable_type' => Event::class,
            'itemable_id' => $event->id,
        ]);
    }

    public function test_paid_registration_not_visible_in_my_events_until_admin_approves(): void
    {
        $event = $this->makeEvent(['fee' => 50000, 'title' => 'Event Berbayar']);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $registerResponse = $this->postJson("/api/v1/events/{$event->slug}/register");
        $orderId = $registerResponse->json('data.order_id');

        $mine = $this->getJson('/api/v1/events/mine');
        $this->assertCount(0, $mine->json('data'));

        // Upload bukti bayar lalu admin approve - alur Order yang sudah ada.
        $this->postJson("/api/v1/orders/{$orderId}/payment-proof", [
            'file' => $this->fakeImage(),
        ])->assertStatus(200);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$orderId}/verify-payment", [
            'decision' => 'approve',
        ])->assertStatus(200);

        Sanctum::actingAs($user);
        $mineAfter = $this->getJson('/api/v1/events/mine');
        $mineAfter->assertStatus(200);
        $titles = collect($mineAfter->json('data'))->pluck('event.title');
        $this->assertTrue($titles->contains('Event Berbayar'));

        $registration = EventRegistration::where('event_id', $event->id)->first();
        $this->assertSame('confirmed', $registration->status);
    }

    public function test_rejected_payment_cancels_event_registration(): void
    {
        $event = $this->makeEvent(['fee' => 50000]);
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $registerResponse = $this->postJson("/api/v1/events/{$event->slug}/register");
        $orderId = $registerResponse->json('data.order_id');

        $this->postJson("/api/v1/orders/{$orderId}/payment-proof", [
            'file' => $this->fakeImage(),
        ])->assertStatus(200);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$orderId}/verify-payment", [
            'decision' => 'reject',
        ])->assertStatus(200);

        $registration = EventRegistration::where('event_id', $event->id)->first();
        $this->assertSame('cancelled', $registration->status);
    }
}
