<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\RoleRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleRequestTest extends TestCase
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
            'name' => 'Test User',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
    }

    /*
    |--------------------------------------------------------------------------
    | Store
    |--------------------------------------------------------------------------
    */

    public function test_user_can_request_to_become_penulis(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/role-requests', [
            'requested_role' => 'penulis',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('role_requests', [
            'user_id' => $user->id,
            'requested_role' => 'penulis',
            'status' => 'pending',
        ]);
    }

    public function test_user_can_request_both_penulis_and_editor(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/role-requests', ['requested_role' => 'penulis'])
            ->assertStatus(201);

        $this->postJson('/api/v1/role-requests', ['requested_role' => 'editor'])
            ->assertStatus(201);

        $this->assertSame(2, RoleRequest::where('user_id', $user->id)->count());
    }

    public function test_user_cannot_request_role_they_already_have(): void
    {
        $user = $this->makeUser(['user', 'penulis']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/role-requests', [
            'requested_role' => 'penulis',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_cannot_duplicate_pending_request(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/role-requests', ['requested_role' => 'penulis'])
            ->assertStatus(201);

        $response = $this->postJson('/api/v1/role-requests', [
            'requested_role' => 'penulis',
        ]);

        $response->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - Approve/Reject
    |--------------------------------------------------------------------------
    */

    public function test_non_admin_cannot_access_admin_role_requests(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/role-requests')->assertStatus(403);
    }

    public function test_admin_can_approve_role_request(): void
    {
        $applicant = $this->makeUser();
        Sanctum::actingAs($applicant);
        $this->postJson('/api/v1/role-requests', ['requested_role' => 'penulis']);
        $roleRequest = RoleRequest::firstOrFail();

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/role-requests/{$roleRequest->id}/approve"
        );

        $response->assertStatus(200);

        $this->assertTrue(
            $applicant->roles()->where('name', 'penulis')->exists()
        );

        $this->assertDatabaseHas('role_requests', [
            'id' => $roleRequest->id,
            'status' => 'approved',
            'reviewed_by' => $admin->id,
        ]);
    }

    public function test_admin_can_reject_role_request(): void
    {
        $applicant = $this->makeUser();
        Sanctum::actingAs($applicant);
        $this->postJson('/api/v1/role-requests', ['requested_role' => 'editor']);
        $roleRequest = RoleRequest::firstOrFail();

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/role-requests/{$roleRequest->id}/reject",
            ['note' => 'Belum memenuhi syarat.']
        );

        $response->assertStatus(200);

        $this->assertFalse(
            $applicant->roles()->where('name', 'editor')->exists()
        );

        $this->assertDatabaseHas('role_requests', [
            'id' => $roleRequest->id,
            'status' => 'rejected',
            'note' => 'Belum memenuhi syarat.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - User Management
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_change_a_users_roles(): void
    {
        $target = $this->makeUser();
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->patchJson(
            "/api/v1/admin/users/{$target->id}/roles",
            ['roles' => ['user', 'admin']]
        );

        $response->assertStatus(200);

        $this->assertTrue($target->roles()->where('name', 'admin')->exists());
        $this->assertTrue($target->roles()->where('name', 'user')->exists());
    }

    public function test_non_admin_cannot_change_roles(): void
    {
        $target = $this->makeUser();
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->patchJson(
            "/api/v1/admin/users/{$target->id}/roles",
            ['roles' => ['admin']]
        )->assertStatus(403);
    }

    public function test_updating_roles_to_empty_array_is_rejected(): void
    {
        $target = $this->makeUser();
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson(
            "/api/v1/admin/users/{$target->id}/roles",
            ['roles' => []]
        )->assertStatus(422);
    }
}
