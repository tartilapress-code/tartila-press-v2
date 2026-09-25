<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicProfileDirectoryTest extends TestCase
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

    private function makePublishedProfile(
        string $penName,
        array $roleNames,
        bool $isPublished = true
    ): User {
        $user = User::create([
            'name' => $penName,
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        PublicProfile::create([
            'user_id' => $user->id,
            'slug' => Str::slug($penName),
            'pen_name' => $penName,
            'bio' => 'Bio singkat '.$penName,
            'is_published' => $isPublished,
        ]);

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

    public function test_show_lists_published_catalog_book_authored_by_profile_owner(): void
    {
        $author = $this->makePublishedProfile('Penulis Buku', ['penulis']);
        $manuscript = $this->makeManuscriptFor($author);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Terbit Uji',
            'authors_text' => $author->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $author->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Penulis Buku'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Terbit Uji'));
        $this->assertNotNull($book);
    }

    public function test_show_excludes_inactive_book(): void
    {
        $author = $this->makePublishedProfile('Penulis Draft', ['penulis']);
        $manuscript = $this->makeManuscriptFor($author);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Belum Aktif',
            'authors_text' => $author->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => false,
            'created_by' => $author->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Penulis Draft'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.books'))->pluck('title');
        $this->assertFalse($titles->contains('Buku Belum Aktif'));
    }

    public function test_show_includes_compilation_book_via_chapter_contribution(): void
    {
        $contributor = $this->makePublishedProfile('Kontributor Bab', ['penulis']);
        $manuscript = $this->makeManuscriptFor($contributor);

        $admin = User::create([
            'name' => 'Admin Test',
            'email' => uniqid('admin').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $compilation = Book::create([
            'title' => 'Kompilasi Book Chapter Uji',
            'authors_text' => 'Beberapa Penulis',
            'price' => 150000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'created_by' => $admin->id,
        ]);

        BookChapter::create([
            'book_id' => $compilation->id,
            'manuscript_id' => $manuscript->id,
            'chapter_number' => 1,
            'title' => 'Bab Kontribusi',
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Kontributor Bab'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.books'))->pluck('title');
        $this->assertTrue($titles->contains('Kompilasi Book Chapter Uji'));
    }

    public function test_show_includes_book_for_co_author_not_just_primary_submitter(): void
    {
        $submitter = User::create([
            'name' => 'Penulis Utama',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $coAuthor = $this->makePublishedProfile('Penulis Kedua', ['penulis']);

        $manuscript = $this->makeManuscriptFor($submitter);
        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $coAuthor->id,
            'position' => 2,
        ]);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Dua Penulis',
            'authors_text' => $submitter->name.', '.$coAuthor->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $submitter->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Penulis Kedua'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Dua Penulis'));
    }

    public function test_show_lists_published_catalog_book_edited_by_profile_owner(): void
    {
        $editor = $this->makePublishedProfile('Editor Buku', ['editor']);
        $penulis = User::create([
            'name' => 'Penulis Diedit',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $manuscript = $this->makeManuscriptFor($penulis, $editor->id);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Hasil Editan',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Editor Buku'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.edited_books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Hasil Editan'));
    }

    public function test_show_includes_compilation_book_via_chapter_editor(): void
    {
        $editor = $this->makePublishedProfile('Editor Bab', ['editor']);
        $penulis = User::create([
            'name' => 'Penulis Bab Diedit',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $manuscript = $this->makeManuscriptFor($penulis, $editor->id);

        $compilation = Book::create([
            'title' => 'Kompilasi Diedit Uji',
            'authors_text' => 'Beberapa Penulis',
            'price' => 150000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'created_by' => $editor->id,
        ]);

        BookChapter::create([
            'book_id' => $compilation->id,
            'manuscript_id' => $manuscript->id,
            'chapter_number' => 1,
            'title' => 'Bab Diedit',
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Editor Bab'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.edited_books'))->pluck('title');
        $this->assertTrue($titles->contains('Kompilasi Diedit Uji'));
    }

    public function test_show_includes_book_owned_by_editor(): void
    {
        $editor = $this->makePublishedProfile('Editor Pemilik Proyek', ['editor']);

        Book::create([
            'title' => 'Buku Proyek Editor',
            'authors_text' => 'Beberapa Penulis',
            'price' => 150000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'owner_editor_id' => $editor->id,
            'created_by' => $editor->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Editor Pemilik Proyek'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.edited_books'))->pluck('title');
        $this->assertTrue($titles->contains('Buku Proyek Editor'));
    }

    public function test_show_excludes_inactive_edited_book(): void
    {
        $editor = $this->makePublishedProfile('Editor Buku Nonaktif', ['editor']);
        $penulis = User::create([
            'name' => 'Penulis Nonaktif',
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $manuscript = $this->makeManuscriptFor($penulis, $editor->id);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Editan Nonaktif',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => false,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson('/api/v1/public/authors/'.Str::slug('Editor Buku Nonaktif'));

        $response->assertStatus(200);
        $titles = collect($response->json('data.profile.edited_books'))->pluck('title');
        $this->assertFalse($titles->contains('Buku Editan Nonaktif'));
    }

    public function test_directory_lists_only_published_profiles(): void
    {
        $this->makePublishedProfile('Penulis Terbit', ['penulis'], true);
        $this->makePublishedProfile('Penulis Sembunyi', ['penulis'], false);

        $response = $this->getJson('/api/v1/public/authors');

        $response->assertStatus(200);
        $names = collect($response->json('data'))->pluck('name');

        $this->assertTrue($names->contains('Penulis Terbit'));
        $this->assertFalse($names->contains('Penulis Sembunyi'));
    }

    public function test_directory_can_filter_by_role(): void
    {
        $this->makePublishedProfile('Hanya Penulis', ['penulis']);
        $this->makePublishedProfile('Hanya Editor', ['editor']);
        $this->makePublishedProfile('Dua Role', ['penulis', 'editor']);

        $penulisResponse = $this->getJson('/api/v1/public/authors?role=penulis');
        $penulisNames = collect($penulisResponse->json('data'))->pluck('name');

        $this->assertTrue($penulisNames->contains('Hanya Penulis'));
        $this->assertTrue($penulisNames->contains('Dua Role'));
        $this->assertFalse($penulisNames->contains('Hanya Editor'));

        $editorResponse = $this->getJson('/api/v1/public/authors?role=editor');
        $editorNames = collect($editorResponse->json('data'))->pluck('name');

        $this->assertTrue($editorNames->contains('Hanya Editor'));
        $this->assertTrue($editorNames->contains('Dua Role'));
        $this->assertFalse($editorNames->contains('Hanya Penulis'));
    }
}
