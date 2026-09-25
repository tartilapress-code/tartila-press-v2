<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\EditorProfile;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pilihan bahasa (boleh lebih dari satu) pada buku, proyek Book Chapter, dan
 * profil editor — plus tampilannya di daftar editor yang dipilih penulis dan
 * di halaman publik.
 */
class ContentLanguagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeEditor(array $profile = []): User
    {
        $editor = $this->makeUser(['editor']);

        EditorProfile::create(array_merge([
            'user_id' => $editor->id,
            'fee' => 50000,
            'is_available' => true,
        ], $profile));

        return $editor;
    }

    private function bookPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Buku Dua Bahasa',
            'authors' => ['Penulis Satu'],
            'price' => 90000,
        ], $overrides);
    }

    private function projectPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Antologi Dua Bahasa',
            'price' => 100000,
            'discount' => 0,
            'chapters' => [
                ['title' => 'Bab 1'],
                ['title' => 'Bab 2'],
            ],
        ], $overrides);
    }

    /*
    |--------------------------------------------------------------------------
    | Buku
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_add_a_book_with_several_languages(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        // Urutan kiriman dan duplikat dirapikan: urut menurut daftar bahasa.
        $response = $this->postJson('/api/v1/admin/books/manual', $this->bookPayload([
            'languages' => ['en', 'id', 'en'],
        ]));

        $response->assertStatus(201)
            ->assertJsonPath('data.languages', ['id', 'en']);

        $this->assertSame(
            ['id', 'en'],
            Book::where('title', 'Buku Dua Bahasa')->firstOrFail()->languages
        );
    }

    public function test_language_is_optional_and_reads_back_as_an_empty_list(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/books/manual', $this->bookPayload())
            ->assertStatus(201)
            ->assertJsonPath('data.languages', []);

        $book = Book::where('title', 'Buku Dua Bahasa')->firstOrFail();

        $this->assertSame([], $book->languages);
        $this->assertSame('[]', $book->getRawOriginal('languages'));
    }

    public function test_rows_created_before_the_feature_also_read_as_an_empty_list(): void
    {
        $admin = $this->makeUser(['admin']);
        $book = Book::create(['title' => 'Buku Lawas', 'authors' => ['A'], 'price' => 1000, 'created_by' => $admin->id]);
        $editor = $this->makeEditor();

        // Baris lama: kolom `languages` masih NULL.
        DB::table('books')->where('id', $book->id)->update(['languages' => null]);
        DB::table('editor_profiles')->where('user_id', $editor->id)->update(['languages' => null]);

        $this->assertSame([], $book->fresh()->languages);
        $this->assertSame([], $editor->editorProfile()->firstOrFail()->languages);

        $this->getJson("/api/v1/books/{$book->fresh()->slug}")->assertOk()->assertJsonPath('data.languages', []);
    }

    public function test_unknown_language_codes_are_rejected(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/books/manual', $this->bookPayload([
            'languages' => ['id', 'xx'],
        ]))->assertStatus(422)->assertJsonValidationErrors('languages.1');

        $this->postJson('/api/v1/admin/books/manual', $this->bookPayload([
            'languages' => 'id',
        ]))->assertStatus(422)->assertJsonValidationErrors('languages');

        $this->assertDatabaseCount('books', 0);
    }

    public function test_admin_can_change_and_clear_a_books_languages(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $book = Book::create([
            'title' => 'Buku Lama',
            'authors' => ['Penulis'],
            'price' => 50000,
            'languages' => ['id'],
            'created_by' => User::first()->id,
        ]);

        $this->patchJson("/api/v1/admin/books/{$book->id}", ['languages' => ['ar', 'ms']])
            ->assertOk()
            ->assertJsonPath('data.languages', ['ms', 'ar']);

        // Kiriman tanpa `languages` tidak menyentuh bahasa yang sudah ada.
        $this->patchJson("/api/v1/admin/books/{$book->id}", ['discount' => 10])
            ->assertOk()
            ->assertJsonPath('data.languages', ['ms', 'ar']);

        $this->patchJson("/api/v1/admin/books/{$book->id}", ['languages' => []])
            ->assertOk()
            ->assertJsonPath('data.languages', []);
    }

    public function test_public_book_detail_and_catalog_expose_the_languages(): void
    {
        $admin = $this->makeUser(['admin']);
        Book::create([
            'title' => 'Buku Publik',
            'authors' => ['Penulis'],
            'price' => 75000,
            'languages' => ['en', 'id'],
            'created_by' => $admin->id,
        ]);
        $book = Book::firstOrFail();

        $this->getJson("/api/v1/books/{$book->slug}")
            ->assertOk()
            ->assertJsonPath('data.languages', ['id', 'en']);

        $this->getJson('/api/v1/books')
            ->assertOk()
            ->assertJsonPath('data.0.languages', ['id', 'en']);
    }

    /*
    |--------------------------------------------------------------------------
    | Proyek Book Chapter
    |--------------------------------------------------------------------------
    */

    public function test_editor_can_set_languages_when_creating_and_updating_own_project(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $created = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'languages' => ['ms', 'id'],
        ]));

        $created->assertStatus(201)->assertJsonPath('data.languages', ['id', 'ms']);
        $projectId = $created->json('data.id');

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$projectId}", [
            'languages' => ['en'],
        ])->assertOk()->assertJsonPath('data.languages', ['en']);

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$projectId}", [
            'languages' => ['nope'],
        ])->assertStatus(422)->assertJsonValidationErrors('languages.0');

        $this->assertSame(['en'], Book::findOrFail($projectId)->languages);
    }

    public function test_admin_can_set_languages_on_a_project_and_the_public_page_shows_them(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $created = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload([
            'languages' => ['ar', 'id'],
        ]));

        $created->assertStatus(201)->assertJsonPath('data.languages', ['id', 'ar']);
        $projectId = $created->json('data.id');

        $this->patchJson("/api/v1/admin/book-chapter-projects/{$projectId}", [
            'languages' => ['id', 'en', 'ar'],
        ])->assertOk()->assertJsonPath('data.languages', ['id', 'en', 'ar']);

        $this->getJson("/api/v1/book-chapter-projects/{$projectId}")
            ->assertOk()
            ->assertJsonPath('data.languages', ['id', 'en', 'ar']);
    }

    public function test_bulk_import_reads_an_optional_languages_column(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $csv = "title,price,chapter_count,languages\n"
            ."Proyek Dwibahasa,100000,2,id;en\n"
            ."Proyek Tanpa Bahasa,100000,2,\n"
            ."Proyek Salah Kode,100000,2,id;xx\n";

        $response = $this->postJson('/api/v1/admin/book-chapter-projects/bulk-import', [
            'file' => UploadedFile::fake()->createWithContent('proyek.csv', $csv),
        ]);

        $response->assertOk()->assertJsonPath('data.created', 2);
        $this->assertCount(1, $response->json('data.errors'));
        $this->assertSame(4, $response->json('data.errors.0.row'));
        $this->assertStringContainsString('xx', $response->json('data.errors.0.message'));

        $this->assertSame(['id', 'en'], Book::where('title', 'Proyek Dwibahasa')->firstOrFail()->languages);
        $this->assertSame([], Book::where('title', 'Proyek Tanpa Bahasa')->firstOrFail()->languages);
    }

    /*
    |--------------------------------------------------------------------------
    | Profil editor & daftar editor untuk penulis
    |--------------------------------------------------------------------------
    */

    public function test_editor_can_save_the_languages_they_master_in_their_profile(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $this->postJson('/api/v1/editor/profile', [
            'fee' => 75000,
            'bio' => 'Editor bahasa dan sastra.',
            'languages' => ['en', 'id', 'ar'],
            'is_available' => true,
        ])->assertOk()->assertJsonPath('data.languages', ['id', 'en', 'ar']);

        $this->getJson('/api/v1/editor/profile')
            ->assertOk()
            ->assertJsonPath('data.languages', ['id', 'en', 'ar'])
            ->assertJsonPath('data.bio', 'Editor bahasa dan sastra.');

        // Menyimpan tanpa `languages` (mis. hanya mengubah fee) tidak menghapusnya.
        $this->postJson('/api/v1/editor/profile', ['fee' => 80000])->assertOk();
        $this->assertSame(['id', 'en', 'ar'], $editor->editorProfile()->firstOrFail()->languages);

        $this->postJson('/api/v1/editor/profile', ['languages' => ['klingon']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('languages.0');
    }

    public function test_only_editors_can_manage_the_editor_profile_languages(): void
    {
        Sanctum::actingAs($this->makeUser(['penulis']));

        $this->postJson('/api/v1/editor/profile', ['languages' => ['id']])->assertForbidden();
    }

    public function test_editor_directory_lists_the_languages_and_bio_of_each_available_editor(): void
    {
        $bilingual = $this->makeEditor([
            'bio' => 'Menyunting naskah ilmiah dua bahasa.',
            'languages' => ['en', 'id'],
        ]);
        $this->makeEditor(['is_available' => false, 'languages' => ['ar']]);
        $noLanguages = $this->makeEditor(['bio' => null]);

        Sanctum::actingAs($this->makeUser(['penulis']));

        $response = $this->getJson('/api/v1/editors')->assertOk();

        $rows = collect($response->json('data'))->keyBy('user_id');

        $this->assertCount(2, $rows);
        $this->assertSame(['id', 'en'], $rows[$bilingual->id]['languages']);
        $this->assertSame('Menyunting naskah ilmiah dua bahasa.', $rows[$bilingual->id]['bio']);
        $this->assertSame([], $rows[$noLanguages->id]['languages']);
        $this->assertNull($rows[$noLanguages->id]['bio']);
    }

    /*
    |--------------------------------------------------------------------------
    | Halaman profil publik
    |--------------------------------------------------------------------------
    */

    private function publishProfileFor(User $user, string $slug): void
    {
        PublicProfile::create([
            'user_id' => $user->id,
            'slug' => Str::slug($slug),
            'pen_name' => $slug,
            'bio' => 'Bio publik '.$slug,
            'is_published' => true,
        ]);
    }

    public function test_public_profile_shows_editor_languages_only_for_editors(): void
    {
        $editor = $this->makeEditor(['languages' => ['id', 'en']]);
        $this->publishProfileFor($editor, 'editor-bahasa');

        // Penulis yang kebetulan punya baris profil editor lama: tidak ditampilkan.
        $author = $this->makeUser(['penulis']);
        EditorProfile::create([
            'user_id' => $author->id,
            'fee' => 0,
            'is_available' => false,
            'languages' => ['ar'],
        ]);
        $this->publishProfileFor($author, 'penulis-biasa');

        $this->getJson('/api/v1/public/authors/editor-bahasa')
            ->assertOk()
            ->assertJsonPath('data.profile.editor_languages', ['id', 'en']);

        $this->getJson('/api/v1/public/authors/penulis-biasa')
            ->assertOk()
            ->assertJsonPath('data.profile.editor_languages', []);
    }

    public function test_public_profile_still_hides_private_editor_data_while_showing_languages(): void
    {
        $editor = $this->makeEditor(['languages' => ['id'], 'fee' => 125000]);
        $this->publishProfileFor($editor, 'editor-privat');

        $response = $this->getJson('/api/v1/public/authors/editor-privat')->assertOk();

        $response->assertJsonPath('data.profile.editor_languages', ['id']);
        $this->assertStringNotContainsString($editor->email, $response->getContent());
        $this->assertStringNotContainsString('125000', $response->getContent());
    }
}
