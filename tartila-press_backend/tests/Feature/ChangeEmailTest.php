<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class ChangeEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'user', 'display_name' => 'User']);
    }

    private function makeUser(string $email = 'lama@example.com'): User
    {
        $user = User::create([
            'name' => 'Budi Santoso',
            'email' => $email,
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::where('name', 'user')->first());

        return $user;
    }

    private function changeLink(User $user, string $email, $expiresAt = null): string
    {
        return URL::temporarySignedRoute(
            'auth.email.change.verify',
            $expiresAt ?? now()->addMinutes(60),
            ['id' => $user->id, 'email' => $email]
        );
    }

    private function frontendResult(string $status): string
    {
        return rtrim(config('app.frontend_url'), '/').'/verifikasi-email?status='.$status;
    }

    private function lastMail(): Email
    {
        $messages = app('mail.manager')->mailer()->getSymfonyTransport()->messages();

        return $messages->last()->getOriginalMessage();
    }

    /*
    |--------------------------------------------------------------------------
    | Minta ganti email
    |--------------------------------------------------------------------------
    */

    public function test_requesting_a_change_sends_a_signed_link_to_the_new_address_only(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/change-email', [
            'email' => 'baru@example.com',
            'current_password' => 'Tartila@2026',
        ])->assertOk();

        $mail = $this->lastMail();

        $this->assertSame(
            ['baru@example.com'],
            array_map(fn ($address) => $address->getAddress(), $mail->getTo())
        );
        $this->assertStringContainsString('Konfirmasi Perubahan Email', $mail->getSubject());

        preg_match('#https?://\S+#', $mail->getTextBody(), $matches);
        $link = $matches[0];

        $this->assertStringContainsString("/api/v1/auth/change-email/verify/{$user->id}", $link);
        $this->assertSame('lama@example.com', $user->fresh()->email, 'Email belum boleh berubah sebelum link diklik.');

        // Link dari email itu benar-benar bekerja.
        $this->get($link)->assertRedirect($this->frontendResult('changed'));
        $this->assertSame('baru@example.com', $user->fresh()->email);
    }

    public function test_requesting_a_change_needs_the_current_password(): void
    {
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/change-email', [
            'email' => 'baru@example.com',
            'current_password' => 'salah-password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.current_password.0', 'Password saat ini salah.');
    }

    public function test_requesting_a_change_rejects_an_email_already_in_use(): void
    {
        $this->makeUser('terpakai@example.com');
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/change-email', [
            'email' => 'terpakai@example.com',
            'current_password' => 'Tartila@2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email sudah digunakan.');
    }

    public function test_requesting_a_change_requires_authentication(): void
    {
        $this->postJson('/api/v1/auth/change-email', [
            'email' => 'baru@example.com',
            'current_password' => 'Tartila@2026',
        ])->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Konfirmasi lewat link
    |--------------------------------------------------------------------------
    */

    public function test_confirming_changes_the_email_and_marks_it_verified_straight_away(): void
    {
        $user = $this->makeUser();
        $this->assertNull($user->email_verified_at);
        $oldToken = $user->createToken('perangkat-lama');

        $this->get($this->changeLink($user, 'baru@example.com'))
            ->assertRedirect($this->frontendResult('changed'));

        $user->refresh();

        $this->assertSame('baru@example.com', $user->email);
        $this->assertNotNull($user->email_verified_at, 'Klik link di email baru sudah membuktikan pemiliknya.');
        $this->assertSame(0, $user->tokens()->count(), 'Semua token lama harus dicabut.');
        $this->assertNull(PersonalAccessToken::find($oldToken->accessToken->id));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'email_change_verified',
            'status' => 'success',
        ]);

        // Login dengan email baru berhasil dan langsung terverifikasi.
        $this->postJson('/api/v1/auth/login', [
            'email' => 'baru@example.com',
            'password' => 'Tartila@2026',
        ])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'baru@example.com')
            ->assertJsonPath('data.user.email_verified_at', fn ($value) => $value !== null);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'lama@example.com',
            'password' => 'Tartila@2026',
        ])->assertStatus(401);
    }

    public function test_a_previously_verified_user_stays_verified_with_the_new_email(): void
    {
        $user = $this->makeUser();
        $user->forceFill(['email_verified_at' => now()->subDays(30)])->save();

        $this->get($this->changeLink($user, 'baru@example.com'))
            ->assertRedirect($this->frontendResult('changed'));

        $user->refresh();

        $this->assertSame('baru@example.com', $user->email);
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertTrue($user->email_verified_at->greaterThan(now()->subMinute()));
    }

    public function test_api_clients_get_json_when_confirming(): void
    {
        $user = $this->makeUser();

        $this->getJson($this->changeLink($user, 'baru@example.com'))
            ->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'Email berhasil diubah dan terverifikasi. Silakan login kembali dengan email baru Anda.',
            ]);

        $this->assertSame('baru@example.com', $user->fresh()->email);
    }

    public function test_reopening_the_link_after_the_change_does_nothing(): void
    {
        $user = $this->makeUser();
        $link = $this->changeLink($user, 'baru@example.com');

        $this->get($link)->assertRedirect($this->frontendResult('changed'));

        // Sesi baru setelah penggantian: tidak boleh ikut tercabut.
        $user->refresh();
        $user->createToken('sesi-baru');
        $verifiedAt = $user->email_verified_at;

        $this->get($link)->assertRedirect($this->frontendResult('changed'));

        $user->refresh();
        $this->assertSame('baru@example.com', $user->email);
        $this->assertSame(1, $user->tokens()->count());
        $this->assertEquals($verifiedAt, $user->email_verified_at);
    }

    public function test_confirming_fails_when_the_new_email_was_taken_in_the_meantime(): void
    {
        $user = $this->makeUser();
        $link = $this->changeLink($user, 'baru@example.com');
        $this->makeUser('baru@example.com');

        $this->get($link)->assertRedirect($this->frontendResult('taken'));
        $this->getJson($link)->assertStatus(422)->assertJson(['success' => false]);

        $this->assertSame('lama@example.com', $user->fresh()->email);
    }

    /*
    |--------------------------------------------------------------------------
    | Link yang tidak valid
    |--------------------------------------------------------------------------
    */

    public function test_tampered_link_is_rejected(): void
    {
        $user = $this->makeUser();
        $tampered = $this->changeLink($user, 'baru@example.com').'x';

        $this->get($tampered)->assertRedirect($this->frontendResult('change-invalid'));
        $this->getJson($tampered)->assertStatus(403);

        $this->assertSame('lama@example.com', $user->fresh()->email);
    }

    public function test_link_for_a_different_email_than_the_one_signed_is_rejected(): void
    {
        $user = $this->makeUser();
        $link = $this->changeLink($user, 'baru@example.com');
        $swapped = str_replace('baru%40example.com', 'penyerang%40example.com', $link);

        $this->assertNotSame($link, $swapped);
        $this->get($swapped)->assertRedirect($this->frontendResult('change-invalid'));

        $this->assertSame('lama@example.com', $user->fresh()->email);
    }

    public function test_expired_link_is_rejected(): void
    {
        $user = $this->makeUser();
        $expired = $this->changeLink($user, 'baru@example.com', now()->subMinute());

        $this->get($expired)->assertRedirect($this->frontendResult('change-invalid'));

        $this->assertSame('lama@example.com', $user->fresh()->email);
    }

    public function test_link_with_a_malformed_email_is_rejected(): void
    {
        $user = $this->makeUser();
        $link = $this->changeLink($user, 'bukan-email');

        $this->get($link)->assertRedirect($this->frontendResult('change-invalid'));
        $this->getJson($link)->assertStatus(422);

        $this->assertSame('lama@example.com', $user->fresh()->email);
    }

    public function test_link_for_a_missing_user_is_rejected(): void
    {
        $link = URL::temporarySignedRoute(
            'auth.email.change.verify',
            now()->addMinutes(60),
            ['id' => 999999, 'email' => 'baru@example.com']
        );

        $this->get($link)->assertRedirect($this->frontendResult('change-invalid'));
        $this->getJson($link)->assertStatus(404);
    }
}
