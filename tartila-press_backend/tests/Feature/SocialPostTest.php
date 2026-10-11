<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SocialPostTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeBook(array $overrides = []): Book
    {
        return Book::create(array_merge([
            'title' => 'Antologi Puisi: Sisi Lain Rumah',
            'authors' => ['Rahima Tartila, S.T', 'Penulis Dua', 'Penulis Tiga'],
            'authors_text' => 'Rahima Tartila, S.T, Penulis Dua, Penulis Tiga',
            'isbn' => '978-634-05-2484-0',
            'price' => 250000,
            'discount' => 20,
            'description' => 'Kumpulan puisi.',
            'is_active' => true,
            'created_by' => $this->makeUser(['admin'])->id,
        ], $overrides));
    }

    public function test_only_admin_can_use_the_social_tools(): void
    {
        $book = $this->makeBook();

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson('/api/v1/admin/social/books')->assertForbidden();
        $this->get("/api/v1/admin/social/books/{$book->id}/cover")->assertForbidden();

        $this->getJson('/api/v1/admin/social/books')->assertForbidden();
    }

    public function test_admin_lists_published_books_with_poster_data(): void
    {
        $book = $this->makeBook();
        $this->makeBook(['title' => 'Belum Terbit', 'is_active' => false]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $response = $this->getJson('/api/v1/admin/social/books')->assertOk()->assertJsonCount(1, 'data');

        $row = $response->json('data.0');
        $this->assertSame($book->id, $row['id']);
        $this->assertSame(['Rahima Tartila, S.T', 'Penulis Dua', 'Penulis Tiga'], $row['authors']);
        $this->assertSame('978-634-05-2484-0', $row['isbn']);
        $this->assertEquals(200000, $row['final_price']);
        $this->assertSame(rtrim(config('app.frontend_url'), '/').'/buku/'.$book->slug, $row['url']);
        $this->assertFalse($row['has_cover']);
    }

    public function test_cover_is_proxied_from_local_storage_and_external_urls(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('covers/uji.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));

        $local = $this->makeBook(['front_cover' => Storage::disk('public')->url('covers/uji.png')]);
        $external = $this->makeBook(['title' => 'Eksternal', 'front_cover' => 'https://93.184.215.14/c.jpg']);
        $none = $this->makeBook(['title' => 'Tanpa Cover']);
        $bad = $this->makeBook(['title' => 'Bukan Gambar', 'front_cover' => 'https://93.184.215.14/x.html']);

        Http::fake([
            '93.184.215.14/c.jpg' => Http::response('JPEGDATA', 200, ['Content-Type' => 'image/jpeg']),
            '93.184.215.14/x.html' => Http::response('<html>', 200, ['Content-Type' => 'text/html']),
        ]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->get("/api/v1/admin/social/books/{$local->id}/cover")->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->get("/api/v1/admin/social/books/{$external->id}/cover")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->getJson("/api/v1/admin/social/books/{$none->id}/cover")->assertNotFound();
        $this->getJson("/api/v1/admin/social/books/{$bad->id}/cover")->assertStatus(422);

        // SSRF: alamat internal / metadata cloud / "../" tidak pernah diambil.
        foreach (['http://127.0.0.1/c.jpg', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/c.jpg', 'http://localhost/c.jpg', '../../.env'] as $source) {
            $internal = $this->makeBook(['title' => 'Internal '.$source, 'front_cover' => $source]);
            $this->getJson("/api/v1/admin/social/books/{$internal->id}/cover")->assertNotFound();
        }

        Http::assertNotSent(fn ($request) => ! str_contains($request->url(), '93.184.215.14'));
    }

    public function test_degrees_split_into_their_own_entries_are_merged_back_into_the_name(): void
    {
        $this->makeBook(['authors' => ['Rahima Tartila', 'S.T', 'Penulis Dua', 'ST'], 'authors_text' => 'x']);

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->getJson('/api/v1/admin/social/books')
            ->assertJsonPath('data.0.authors', ['Rahima Tartila, S.T', 'Penulis Dua, ST']);
    }
}
