<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MyPublicProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor'] as $name) {
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

    private function makeManuscriptFor(User $author, ?int $editorId = null): Manuscript
    {
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $author->id,
            'status' => 'confirmed',
            'subtotal' => 500000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 500000,
        ]);

        $manuscript = Manuscript::create([
            'order_id' => $order->id,
            'user_id' => $author->id,
            'title' => 'Naskah '.uniqid(),
            'authors' => [$author->name],
            'status' => 'completed',
            'editor_id' => $editorId,
        ]);

        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $author->id,
            'position' => 1,
        ]);

        return $manuscript;
    }

    public function test_show_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/auth/public-profile');

        $response->assertStatus(401);
    }

    public function test_show_returns_null_data_when_profile_not_created_yet(): void
    {
        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);

        $response = $this->getJson('/api/v1/auth/public-profile');

        $response->assertStatus(200);
        $response->assertJsonPath('data', null);
        $this->assertSame([], $response->json('books'));
        $this->assertSame([], $response->json('edited_books'));
    }

    public function test_show_lists_own_published_catalog_book_as_author(): void
    {
        $penulis = $this->makeUser(['penulis']);
        PublicProfile::create([
            'user_id' => $penulis->id,
            'slug' => 'penulis-uji-dasbor',
            'pen_name' => $penulis->name,
            'is_published' => true,
        ]);
        $manuscript = $this->makeManuscriptFor($penulis);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Dasbor Uji',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        Sanctum::actingAs($penulis);
        $response = $this->getJson('/api/v1/auth/public-profile');

        $response->assertStatus(200);
        $titles = collect($response->json('books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Dasbor Uji'));
        $this->assertSame([], $response->json('edited_books'));
    }

    public function test_show_lists_own_edited_catalog_book(): void
    {
        $editor = $this->makeUser(['editor']);
        $penulis = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscriptFor($penulis, $editor->id);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Editan Dasbor Uji',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        Sanctum::actingAs($editor);
        $response = $this->getJson('/api/v1/auth/public-profile');

        $response->assertStatus(200);
        $titles = collect($response->json('edited_books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Editan Dasbor Uji'));
        $this->assertSame([], $response->json('books'));
    }

    public function test_show_excludes_inactive_own_book(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscriptFor($penulis);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Dasbor Nonaktif',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => false,
            'created_by' => $penulis->id,
        ]);

        Sanctum::actingAs($penulis);
        $response = $this->getJson('/api/v1/auth/public-profile');

        $response->assertStatus(200);
        $titles = collect($response->json('books'))->pluck('title');
        $this->assertFalse($titles->contains('Buku Dasbor Nonaktif'));
    }
}
