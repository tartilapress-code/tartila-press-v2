<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use RuntimeException;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const GENERIC_MESSAGE = 'Jika email terdaftar, link reset password telah dikirim. Cek kotak masuk dan folder spam.';

    private const INVALID_TOKEN_MESSAGE = 'Token reset password tidak valid atau telah kedaluwarsa.';

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'user', 'display_name' => 'User']);
    }

    private function makeUser(string $email = 'siti@example.com'): User
    {
        $user = User::create([
            'name' => 'Siti Aminah',
            'email' => $email,
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::where('name', 'user')->first());

        return $user;
    }

    private function resetPayload(User $user, string $token, array $overrides = []): array
    {
        return array_merge([
            'token' => $token,
            'email' => $user->email,
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBaru@2026',
        ], $overrides);
    }

    /*
    |--------------------------------------------------------------------------
    | Lupa password (minta link)
    |--------------------------------------------------------------------------
    */

    public function test_forgot_password_sends_a_reset_link_pointing_to_the_frontend(): void
    {
        Notification::fake();
        $user = $this->makeUser();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJson(['success' => true, 'message' => self::GENERIC_MESSAGE]);

        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
            $html = (string) $notification->toMail($user)->render();

            $this->assertStringContainsString(
                rtrim(config('app.frontend_url'), '/').'/reset-password?token='.$notification->token,
                $html
            );
            $this->assertStringContainsString('email='.urlencode($user->email), $html);

            return true;
        });
    }

    public function test_reset_email_is_written_in_indonesian(): void
    {
        $user = $this->makeUser();

        $mail = (new ResetPassword('token-uji'))->toMail($user);
        $html = (string) $mail->render();

        $this->assertSame('Reset Password - Tartila Press', $mail->subject);
        $this->assertStringContainsString('Halo, Siti Aminah!', $html);
        $this->assertStringContainsString('Buat Password Baru', $html);
        $this->assertStringContainsString('berlaku selama 60 menit', $html);
        $this->assertStringContainsString('/reset-password?token=token-uji', $html);
    }

    public function test_forgot_password_answers_the_same_for_unknown_emails(): void
    {
        Notification::fake();
        $user = $this->makeUser();

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email]);
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'tidak-ada@example.com']);

        $unknown->assertOk();
        $this->assertSame($known->status(), $unknown->status());
        $this->assertSame($known->json(), $unknown->json());

        // Hanya akun yang benar-benar ada yang menerima email.
        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_asking_again_within_a_minute_sends_no_second_email_but_answers_the_same(): void
    {
        Notification::fake();
        $user = $this->makeUser();

        $first = $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email]);
        $second = $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email]);

        $second->assertOk();
        $this->assertSame($first->json(), $second->json());
        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_forgot_password_validates_the_email(): void
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'bukan-email'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Format email tidak valid.');

        $this->postJson('/api/v1/auth/forgot-password', [])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email wajib diisi.');
    }

    public function test_forgot_password_is_rate_limited(): void
    {
        Notification::fake();

        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => "orang{$i}@example.com"])
                ->assertOk();
        }

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'orang6@example.com'])
            ->assertStatus(429);
    }

    public function test_forgot_password_reports_a_failure_when_the_email_cannot_be_sent(): void
    {
        Exceptions::fake();
        $user = $this->makeUser();
        $this->mock(Dispatcher::class, function ($mock) {
            $mock->shouldReceive('send')->andThrow(new RuntimeException('smtp down'));
        });

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertStatus(503)
            ->assertJson(['success' => false]);

        Exceptions::assertReported(RuntimeException::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Reset password (pakai link)
    |--------------------------------------------------------------------------
    */

    public function test_reset_changes_the_password_and_revokes_all_tokens(): void
    {
        $user = $this->makeUser();
        $user->createToken('perangkat-lama');
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token))
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertTrue(Hash::check('PasswordBaru@2026', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'password_reset',
            'status' => 'success',
        ]);

        // Login dengan password baru berhasil, yang lama tidak.
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'PasswordBaru@2026',
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Tartila@2026',
        ])->assertStatus(401);
    }

    public function test_reset_token_can_only_be_used_once(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token))
            ->assertOk();

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token, [
            'password' => 'LagiBaru@2026',
            'password_confirmation' => 'LagiBaru@2026',
        ]))
            ->assertStatus(422)
            ->assertJson(['success' => false, 'message' => self::INVALID_TOKEN_MESSAGE]);

        $this->assertTrue(Hash::check('PasswordBaru@2026', $user->fresh()->password));
    }

    public function test_reset_rejects_an_invalid_token(): void
    {
        $user = $this->makeUser();
        Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, 'token-ngawur'))
            ->assertStatus(422)
            ->assertJson(['success' => false, 'message' => self::INVALID_TOKEN_MESSAGE]);

        $this->assertTrue(Hash::check('Tartila@2026', $user->fresh()->password));
    }

    public function test_reset_rejects_a_token_that_belongs_to_another_email(): void
    {
        $owner = $this->makeUser('pemilik@example.com');
        $other = $this->makeUser('lain@example.com');
        $token = Password::createToken($owner);

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($other, $token))
            ->assertStatus(422)
            ->assertJson(['message' => self::INVALID_TOKEN_MESSAGE]);

        $this->assertTrue(Hash::check('Tartila@2026', $other->fresh()->password));
    }

    public function test_reset_rejects_weak_passwords_with_indonesian_messages(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        $cases = [
            'pendek' => ['Ab1!', 'Password minimal 8 karakter.'],
            'tanpa huruf besar' => ['passwordku1!', 'Password harus mengandung huruf besar dan huruf kecil.'],
            'tanpa angka' => ['Passwordku!!', 'Password harus mengandung angka.'],
            'tanpa simbol' => ['Passwordku12', 'Password harus mengandung simbol.'],
        ];

        foreach ($cases as $label => [$password, $expected]) {
            $response = $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token, [
                'password' => $password,
                'password_confirmation' => $password,
            ]));

            $response->assertStatus(422);
            $this->assertContains($expected, $response->json('errors.password'), $label);
        }

        // Token tidak terpakai oleh percobaan yang gagal validasi.
        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token))
            ->assertOk();
    }

    public function test_reset_rejects_a_mismatched_confirmation(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', $this->resetPayload($user, $token, [
            'password_confirmation' => 'BedaSama@2026',
        ]))
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Konfirmasi password tidak sesuai.');
    }
}
