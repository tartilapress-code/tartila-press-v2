<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create([
            'name' => 'user',
            'display_name' => 'User',
        ]);

        Role::create([
            'name' => 'penulis',
            'display_name' => 'Penulis',
        ]);

        Role::create([
            'name' => 'editor',
            'display_name' => 'Editor',
        ]);

        Role::create([
            'name' => 'admin',
            'display_name' => 'Administrator',
        ]);
    }

    private function validRegisterPayload(array $overrides = []): array
    {
        return array_merge([
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
        ], $overrides);
    }

    /*
    |--------------------------------------------------------------------------
    | Register - Default Role
    |--------------------------------------------------------------------------
    */

    public function test_register_always_assigns_user_role(): void
    {
        $response = $this->postJson(
            '/api/v1/auth/register',
            $this->validRegisterPayload()
        );

        $response->assertStatus(201);
        $response->assertJson(['success' => true]);

        $user = User::where('email', 'budi@example.com')->firstOrFail();

        $this->assertTrue(
            $user->roles()->where('name', 'user')->exists()
        );

        $this->assertFalse(
            $user->roles()->where('name', 'penulis')->exists()
        );

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'register',
            'status' => 'success',
        ]);
    }

    public function test_register_ignores_spoofed_role_field(): void
    {
        $response = $this->postJson(
            '/api/v1/auth/register',
            $this->validRegisterPayload(['role' => 'admin'])
        );

        $response->assertStatus(201);

        $user = User::where('email', 'budi@example.com')->firstOrFail();

        $this->assertTrue(
            $user->roles()->where('name', 'user')->exists()
        );

        $this->assertFalse(
            $user->roles()->where('name', 'admin')->exists()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Register - Password Policy
    |--------------------------------------------------------------------------
    */

    public function test_register_rejects_weak_password(): void
    {
        $response = $this->postJson(
            '/api/v1/auth/register',
            $this->validRegisterPayload([
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ])
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    /*
    |--------------------------------------------------------------------------
    | Login - Lockout
    |--------------------------------------------------------------------------
    */

    public function test_login_locks_out_after_five_failed_attempts(): void
    {
        $user = User::create([
            'name' => 'Siti Aminah',
            'email' => 'siti@example.com',
            'password' => 'Tartila@2026',
        ]);

        for ($i = 1; $i <= 5; $i++) {
            $response = $this->postJson('/api/v1/auth/login', [
                'email' => 'siti@example.com',
                'password' => 'wrong-password',
            ]);

            $response->assertStatus(401);
        }

        $lockedResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'siti@example.com',
            'password' => 'wrong-password',
        ]);

        $lockedResponse->assertStatus(429);

        $this->assertSame(
            5,
            AuditLog::where('action', 'login')
                ->where('status', 'failed')
                ->count()
        );

        $this->assertSame(
            1,
            AuditLog::where('action', 'login')
                ->where('status', 'locked_out')
                ->count()
        );

        /*
        |--------------------------------------------------------------------------
        | Correct password is still rejected while locked out
        |--------------------------------------------------------------------------
        */

        $stillLocked = $this->postJson('/api/v1/auth/login', [
            'email' => 'siti@example.com',
            'password' => 'Tartila@2026',
        ]);

        $stillLocked->assertStatus(429);
    }

    public function test_login_succeeds_and_logs_audit_entry(): void
    {
        User::create([
            'name' => 'Dewi Lestari',
            'email' => 'dewi@example.com',
            'password' => 'Tartila@2026',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'dewi@example.com',
            'password' => 'Tartila@2026',
        ]);

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'login',
            'status' => 'success',
        ]);
    }
}
