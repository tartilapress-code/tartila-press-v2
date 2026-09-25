<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Register, ganti password, dan reset password memakai aturan yang sama
 * (Password::defaults). Test ini memastikan ketiganya juga memberi pesan
 * yang sama (Bahasa Indonesia).
 */
class PasswordPolicyMessagesTest extends TestCase
{
    use RefreshDatabase;

    private const MIXED_CASE = 'Password harus mengandung huruf besar dan huruf kecil.';

    private const WEAK_PASSWORDS = [
        'pendek' => ['Ab1!', 'Password minimal 8 karakter.'],
        'tanpa huruf besar' => ['passwordku1!', self::MIXED_CASE],
        'tanpa huruf kecil' => ['PASSWORDKU1!', self::MIXED_CASE],
        'tanpa angka' => ['Passwordku!!', 'Password harus mengandung angka.'],
        'tanpa simbol' => ['Passwordku12', 'Password harus mengandung simbol.'],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'user', 'display_name' => 'User']);
    }

    /**
     * [form, pesan "wajib diisi" untuk field password di form itu]
     */
    public static function forms(): array
    {
        return [
            'register' => ['register', 'Password wajib diisi.'],
            'ganti password' => ['change-password', 'Password baru wajib diisi.'],
            'reset password' => ['reset-password', 'Password baru wajib diisi.'],
        ];
    }

    private function makeUser(): User
    {
        $user = User::create([
            'name' => 'Budi Santoso',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::where('name', 'user')->first());

        return $user;
    }

    /**
     * Kirim $fields (password / password_confirmation) ke form yang dimaksud,
     * dengan sisa isian yang valid.
     */
    private function submit(string $form, array $fields): TestResponse
    {
        if ($form === 'register') {
            return $this->postJson('/api/v1/auth/register', array_merge([
                'name' => 'Budi Santoso',
                'email' => uniqid('baru').'@example.com',
                'education_level' => 'S1',
                'institution' => 'Universitas Indonesia',
                'age' => 25,
                'gender' => 'male',
                'occupation' => 'Karyawan',
                'phone' => '081234567890',
            ], $fields));
        }

        $user = $this->makeUser();

        if ($form === 'change-password') {
            Sanctum::actingAs($user);

            return $this->postJson('/api/v1/auth/change-password', array_merge([
                'current_password' => 'Tartila@2026',
            ], $fields));
        }

        return $this->postJson('/api/v1/auth/reset-password', array_merge([
            'token' => Password::createToken($user),
            'email' => $user->email,
        ], $fields));
    }

    /*
    |--------------------------------------------------------------------------
    | Sama di ketiga form
    |--------------------------------------------------------------------------
    */

    #[DataProvider('forms')]
    public function test_weak_passwords_get_the_same_indonesian_messages(string $form): void
    {
        foreach (self::WEAK_PASSWORDS as $label => [$password, $expected]) {
            $response = $this->submit($form, [
                'password' => $password,
                'password_confirmation' => $password,
            ]);

            $response->assertStatus(422);
            $this->assertContains($expected, $response->json('errors.password'), "{$form} / {$label}");
        }
    }

    #[DataProvider('forms')]
    public function test_a_mismatched_confirmation_gets_the_same_message(string $form): void
    {
        $this->submit($form, [
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBeda@2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Konfirmasi password tidak sesuai.');
    }

    #[DataProvider('forms')]
    public function test_a_missing_password_is_reported_in_indonesian(string $form, string $expected): void
    {
        $this->submit($form, [])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', $expected);
    }

    /*
    |--------------------------------------------------------------------------
    | Ganti password
    |--------------------------------------------------------------------------
    */

    public function test_change_password_updates_the_password_and_revokes_all_tokens(): void
    {
        $user = $this->makeUser();
        $user->createToken('perangkat-lama');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'Tartila@2026',
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBaru@2026',
        ])
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertTrue(Hash::check('PasswordBaru@2026', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'password_change',
            'status' => 'success',
        ]);
    }

    public function test_change_password_reports_a_wrong_current_password(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'PasswordSalah@2026',
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBaru@2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.current_password.0', 'Password saat ini salah.');

        $this->assertTrue(Hash::check('Tartila@2026', $user->fresh()->password));
    }

    public function test_change_password_requires_the_current_password(): void
    {
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/change-password', [
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBaru@2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.current_password.0', 'Password saat ini wajib diisi.');
    }

    public function test_change_password_rejects_reusing_the_current_password(): void
    {
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'Tartila@2026',
            'password' => 'Tartila@2026',
            'password_confirmation' => 'Tartila@2026',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Password baru harus berbeda dari password saat ini.');
    }

    public function test_change_password_requires_authentication(): void
    {
        $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'Tartila@2026',
            'password' => 'PasswordBaru@2026',
            'password_confirmation' => 'PasswordBaru@2026',
        ])->assertStatus(401);
    }
}
