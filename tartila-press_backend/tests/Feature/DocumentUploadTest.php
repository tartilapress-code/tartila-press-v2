<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        Role::create(['name' => 'user', 'display_name' => 'User']);
    }

    private function makeUser(): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::where('name', 'user')->first());

        return $user;
    }

    public function test_authenticated_user_can_upload_a_pdf_document(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/uploads/documents', [
            'file' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf'),
            'folder' => 'event-documents',
        ]);

        $response->assertStatus(201);
        $this->assertStringContainsString(
            "uploads/event-documents/{$user->id}/",
            $response->json('data.url')
        );
        Storage::disk('public')->assertExists(
            'uploads/event-documents/'.$user->id.'/'.basename($response->json('data.url'))
        );
    }

    public function test_upload_rejects_disallowed_file_types(): void
    {
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/uploads/documents', [
            'file' => UploadedFile::fake()->create('skrip.exe', 10, 'application/octet-stream'),
        ])->assertStatus(422);
    }

    public function test_upload_rejects_unknown_folder(): void
    {
        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/auth/uploads/documents', [
            'file' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf'),
            'folder' => '../../etc',
        ])->assertStatus(422);
    }

    public function test_upload_requires_authentication(): void
    {
        $this->postJson('/api/v1/auth/uploads/documents', [
            'file' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf'),
        ])->assertStatus(401);
    }
}
