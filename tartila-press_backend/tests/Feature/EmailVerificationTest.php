<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Event;
use App\Models\FieldCategory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'user', 'display_name' => 'User']);
        Role::create(['name' => 'admin', 'display_name' => 'Administrator']);
    }

    private function makeUser(bool $verified = false): User
    {
        $user = User::create([
            'name' => 'Budi Santoso',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::where('name', 'user')->first());

        if ($verified) {
            $user->markEmailAsVerified();
        }

        return $user;
    }

    private function verificationUrl(User $user, ?string $hashOf = null, $expiresAt = null): string
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            $expiresAt ?? now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($hashOf ?? $user->email)]
        );
    }

    private function frontendResult(string $status): string
    {
        return rtrim(config('app.frontend_url'), '/').'/verifikasi-email?status='.$status;
    }

    private function registerPayload(): array
    {
        return [
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'password' => 'Tartila@2026',
            'password_confirmation' => 'Tartila@2026',
            'education_level' => 'S1',
            'institution' => 'Universitas Indonesia',
            'age' => 25,
            'gender' => 'male',
            'occupation' => 'Karyawan',
            'phone' => '081234567890',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Kirim saat registrasi
    |--------------------------------------------------------------------------
    */

    public function test_register_sends_a_verification_email(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', $this->registerPayload())
            ->assertStatus(201);

        $user = User::where('email', 'budi@example.com')->firstOrFail();

        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_register_still_succeeds_when_the_email_cannot_be_sent(): void
    {
        Exceptions::fake();
        $this->mock(Dispatcher::class, function ($mock) {
            $mock->shouldReceive('send')->andThrow(new RuntimeException('smtp down'));
        });

        $this->postJson('/api/v1/auth/register', $this->registerPayload())
            ->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', ['email' => 'budi@example.com']);
        Exceptions::assertReported(RuntimeException::class);
    }

    public function test_verification_email_is_in_indonesian_and_carries_a_signed_link(): void
    {
        $user = $this->makeUser();

        $mail = (new VerifyEmail)->toMail($user);
        $html = (string) $mail->render();

        $this->assertSame('Verifikasi Email - Tartila Press', $mail->subject);
        $this->assertStringContainsString('Halo, Budi Santoso!', $html);
        $this->assertStringContainsString('Klik tombol di bawah ini', $html);
        $this->assertStringContainsString(
            "/api/v1/auth/email/verify/{$user->id}/".sha1($user->email),
            $html
        );
        $this->assertStringContainsString('signature=', $html);
    }

    /*
    |--------------------------------------------------------------------------
    | Kirim ulang
    |--------------------------------------------------------------------------
    */

    public function test_unverified_user_can_request_a_new_verification_email(): void
    {
        Notification::fake();
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/email/verification-notification')
            ->assertOk()
            ->assertJson(['success' => true]);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_verified_user_cannot_request_a_verification_email(): void
    {
        Notification::fake();
        Sanctum::actingAs($this->makeUser(verified: true));

        $this->postJson('/api/v1/auth/email/verification-notification')
            ->assertStatus(400);

        Notification::assertNothingSent();
    }

    public function test_resend_requires_authentication(): void
    {
        $this->postJson('/api/v1/auth/email/verification-notification')
            ->assertStatus(401);
    }

    public function test_resend_is_rate_limited(): void
    {
        Notification::fake();
        Sanctum::actingAs($this->makeUser());

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/auth/email/verification-notification')
                ->assertOk();
        }

        $this->postJson('/api/v1/auth/email/verification-notification')
            ->assertStatus(429);
    }

    public function test_resend_reports_a_failure_when_the_email_cannot_be_sent(): void
    {
        Exceptions::fake();
        $this->mock(Dispatcher::class, function ($mock) {
            $mock->shouldReceive('send')->andThrow(new RuntimeException('smtp down'));
        });
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/email/verification-notification')
            ->assertStatus(503)
            ->assertJson(['success' => false]);

        Exceptions::assertReported(RuntimeException::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Link verifikasi
    |--------------------------------------------------------------------------
    */

    public function test_opening_the_link_in_a_browser_verifies_and_redirects_to_the_frontend(): void
    {
        $user = $this->makeUser();

        $this->get($this->verificationUrl($user))
            ->assertRedirect($this->frontendResult('success'));

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'email_verified',
            'status' => 'success',
        ]);
    }

    public function test_api_clients_get_json_from_the_link(): void
    {
        $user = $this->makeUser();

        $this->getJson($this->verificationUrl($user))
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_link_for_an_already_verified_user_reports_already(): void
    {
        $user = $this->makeUser(verified: true);
        $verifiedAt = $user->email_verified_at;

        $this->get($this->verificationUrl($user))
            ->assertRedirect($this->frontendResult('already'));

        $this->assertEquals($verifiedAt, $user->fresh()->email_verified_at);
    }

    public function test_link_with_a_tampered_signature_is_rejected(): void
    {
        $user = $this->makeUser();
        $tampered = $this->verificationUrl($user).'x';

        $this->get($tampered)->assertRedirect($this->frontendResult('invalid'));
        $this->getJson($tampered)->assertStatus(403);

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_expired_link_is_rejected(): void
    {
        $user = $this->makeUser();
        $expired = $this->verificationUrl($user, expiresAt: now()->subMinute());

        $this->get($expired)->assertRedirect($this->frontendResult('invalid'));

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_validly_signed_link_for_another_email_is_rejected(): void
    {
        // Contoh: link lama yang terbit sebelum user mengganti emailnya.
        $user = $this->makeUser();
        $stale = $this->verificationUrl($user, hashOf: 'email-lama@example.com');

        $this->get($stale)->assertRedirect($this->frontendResult('invalid'));
        $this->getJson($stale)->assertStatus(403);

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_link_for_a_missing_user_is_rejected(): void
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => 999999, 'hash' => sha1('siapa@example.com')]
        );

        $this->get($url)->assertRedirect($this->frontendResult('invalid'));
        $this->getJson($url)->assertStatus(404);
    }

    /*
    |--------------------------------------------------------------------------
    | Penegakan (REQUIRE_VERIFIED_EMAIL)
    |--------------------------------------------------------------------------
    */

    /**
     * @return array<int, array{0: string, 1: string}> [method, url]
     */
    private function gatedRoutes(): array
    {
        $admin = $this->makeUser(verified: true);

        $article = Article::create([
            'user_id' => $admin->id,
            'title' => 'Artikel Uji',
            'field_category_id' => FieldCategory::create(['name' => 'Teknologi'])->id,
            'body' => 'Isi essay uji coba yang cukup panjang untuk dites.',
            'status' => 'approved',
            'published_at' => now(),
        ]);

        $event = Event::create([
            'title' => 'Event Uji',
            'description' => 'Deskripsi event uji.',
            'starts_at' => now()->addWeek(),
            'fee' => 0,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        return [
            ['POST', '/api/v1/orders'],
            ['POST', "/api/v1/events/{$event->slug}/register"],
            ['POST', '/api/v1/articles'],
            ['POST', "/api/v1/articles/{$article->slug}/comments"],
        ];
    }

    public function test_unverified_user_is_blocked_from_sensitive_actions_when_enforcement_is_on(): void
    {
        config(['app.require_verified_email' => true]);
        $routes = $this->gatedRoutes();
        Sanctum::actingAs($this->makeUser());

        foreach ($routes as [$method, $url]) {
            $this->json($method, $url, [])
                ->assertStatus(403)
                ->assertJson(['error_code' => 'EMAIL_NOT_VERIFIED']);
        }
    }

    public function test_verified_user_is_not_blocked_when_enforcement_is_on(): void
    {
        config(['app.require_verified_email' => true]);
        $routes = $this->gatedRoutes();
        Sanctum::actingAs($this->makeUser(verified: true));

        foreach ($routes as [$method, $url]) {
            $status = $this->json($method, $url, [])->getStatusCode();

            $this->assertNotContains($status, [401, 403], "{$method} {$url} diblokir");
        }
    }

    public function test_nobody_is_blocked_while_enforcement_is_off(): void
    {
        $routes = $this->gatedRoutes();
        Sanctum::actingAs($this->makeUser());

        foreach ($routes as [$method, $url]) {
            $status = $this->json($method, $url, [])->getStatusCode();

            $this->assertNotContains($status, [401, 403], "{$method} {$url} diblokir");
        }
    }

    public function test_unverified_user_can_still_reach_account_endpoints_when_enforcement_is_on(): void
    {
        config(['app.require_verified_email' => true]);
        Notification::fake();
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->postJson('/api/v1/auth/email/verification-notification')->assertOk();

        Notification::assertSentTo($user, VerifyEmail::class);
    }
}
