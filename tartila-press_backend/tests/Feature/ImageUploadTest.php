<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImageUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

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

    /**
     * A real (tiny, 1x1) PNG's bytes - avoids depending on the GD extension,
     * which UploadedFile::fake()->image() requires but isn't installed here.
     */
    private function fakeImage(string $name = 'cover.png'): UploadedFile
    {
        $onePixelPng = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        );

        return UploadedFile::fake()->createWithContent($name, $onePixelPng);
    }

    public function test_authenticated_user_can_upload_an_image_and_gets_a_url_back(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/uploads/images', [
            'file' => $this->fakeImage('cover.jpg'),
            'folder' => 'covers',
        ]);

        $response->assertStatus(201);
        $url = $response->json('data.url');

        $this->assertNotNull($url);
        $this->assertStringContainsString('/storage/uploads/covers/'.$user->id.'/', $url);

        $path = Str::after(parse_url($url, PHP_URL_PATH), '/storage/');
        Storage::disk('public')->assertExists($path);
    }

    public function test_upload_defaults_to_misc_folder_when_none_given(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/uploads/images', [
            'file' => $this->fakeImage('photo.png'),
        ]);

        $response->assertStatus(201);
        $this->assertStringContainsString('/storage/uploads/misc/', $response->json('data.url'));
    }

    public function test_upload_rejects_non_image_files(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/uploads/images', [
            'file' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(422);
    }

    public function test_upload_rejects_invalid_folder(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/uploads/images', [
            'file' => $this->fakeImage('cover.jpg'),
            'folder' => 'not-a-real-folder',
        ]);

        $response->assertStatus(422);
    }

    public function test_guest_cannot_upload_images(): void
    {
        $this->postJson('/api/v1/auth/uploads/images', [
            'file' => $this->fakeImage('cover.jpg'),
        ])->assertStatus(401);
    }
}
