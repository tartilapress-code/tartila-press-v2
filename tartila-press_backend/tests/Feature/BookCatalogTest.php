<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookCategory;
use App\Models\BookChapter;
use App\Models\BookReview;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\Package;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookCatalogTest extends TestCase
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

    private function makeCompletedManuscript(?User $penulis = null, string $title = 'Judul Naskah'): Manuscript
    {
        $penulis ??= $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);

        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 1000000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => $package->price,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => $package->price,
        ]);

        return Manuscript::create([
            'order_id' => $order->id,
            'user_id' => $penulis->id,
            'title' => $title,
            'authors' => [$penulis->name],
            'status' => 'completed',
        ]);
    }

    private function pdf(string $name = 'preview.pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, 200, 'application/pdf');
    }

    /*
    |--------------------------------------------------------------------------
    | Publish From Manuscript
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_publish_book_from_completed_manuscript(): void
    {
        $manuscript = $this->makeCompletedManuscript(null, 'Rahasia Senja');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 150000]
        );

        $response->assertStatus(201);
        $response->assertJsonPath('data.title', 'Rahasia Senja');

        $this->assertDatabaseHas('books', [
            'manuscript_id' => $manuscript->id,
            'title' => 'Rahasia Senja',
        ]);
    }

    public function test_cannot_publish_book_from_incomplete_manuscript(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        $manuscript->update(['status' => 'in_editing']);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 150000]
        )->assertStatus(422);
    }

    public function test_cannot_publish_same_manuscript_twice(): void
    {
        $manuscript = $this->makeCompletedManuscript();

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 150000]
        )->assertStatus(201);

        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 150000]
        )->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Book
    |--------------------------------------------------------------------------
    */

    public function test_book_price_exceeding_column_limit_is_rejected_with_validation_error(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/books/manual', [
            'title' => 'Buku Mahal',
            'authors' => ['Penulis'],
            'price' => 600000000000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('price');
        $this->assertDatabaseMissing('books', ['title' => 'Buku Mahal']);
    }

    public function test_admin_can_create_book_manually(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/books/manual', [
            'title' => 'Buku Lama',
            'authors' => ['Penulis Lama'],
            'price' => 100000,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('books', [
            'title' => 'Buku Lama',
            'manuscript_id' => null,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Book Chapter Compilation
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_combine_manuscripts_into_book_chapters(): void
    {
        $authorA = $this->makeUser(['penulis']);
        $authorB = $this->makeUser(['penulis']);

        $manuscriptA = $this->makeCompletedManuscript($authorA, 'Bab Satu');
        $manuscriptB = $this->makeCompletedManuscript($authorB, 'Bab Dua');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/books/chapter-compilation', [
            'title' => 'Kumpulan Esai 2026',
            'manuscript_ids' => [$manuscriptA->id, $manuscriptB->id],
            'price' => 200000,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.is_chapter_compilation', true);

        $this->assertDatabaseHas('book_chapters', [
            'manuscript_id' => $manuscriptA->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
        ]);

        $this->assertDatabaseHas('book_chapters', [
            'manuscript_id' => $manuscriptB->id,
            'chapter_number' => 2,
            'title' => 'Bab Dua',
        ]);

        $bookSlug = $response->json('data.slug');

        $show = $this->getJson("/api/v1/books/{$bookSlug}");
        $show->assertStatus(200);
        $this->assertSame(
            $authorA->name,
            $show->json('data.chapters.0.manuscript.user.name')
        );
    }

    public function test_cannot_combine_manuscript_already_used_elsewhere(): void
    {
        $manuscript = $this->makeCompletedManuscript();

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        )->assertStatus(201);

        $anotherManuscript = $this->makeCompletedManuscript();

        $this->postJson('/api/v1/admin/books/chapter-compilation', [
            'title' => 'Kompilasi',
            'manuscript_ids' => [$manuscript->id, $anotherManuscript->id],
            'price' => 100000,
        ])->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Editor Name & Cover/Layout Designer
    |--------------------------------------------------------------------------
    */

    public function test_book_detail_exposes_editor_name_and_cover_layout_designer(): void
    {
        $editor = $this->makeUser(['editor']);
        $manuscript = $this->makeCompletedManuscript(null, 'Embedded System');
        $manuscript->update(['editor_id' => $editor->id]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            [
                'price' => 150000,
                'cover_layout_designer' => 'Studio Kreatif Nusantara',
            ]
        );
        $bookSlug = $response->json('data.slug');

        $show = $this->getJson("/api/v1/books/{$bookSlug}");

        $show->assertStatus(200);
        $show->assertJsonPath('data.editor_name', $editor->name);
        $show->assertJsonPath('data.cover_layout_designer', 'Studio Kreatif Nusantara');
    }

    /*
    |--------------------------------------------------------------------------
    | Public Catalog
    |--------------------------------------------------------------------------
    */

    public function test_catalog_only_lists_active_books(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        );
        $bookId = $response->json('data.id');

        $this->patchJson("/api/v1/admin/books/{$bookId}", ['is_active' => false]);

        $catalog = $this->getJson('/api/v1/books');
        $ids = collect($catalog->json('data'))->pluck('id');

        $this->assertFalse($ids->contains($bookId));
    }

    public function test_catalog_can_filter_by_category_and_search(): void
    {
        $novelCategory = BookCategory::create(['name' => 'Novel']);
        $textbookCategory = BookCategory::create(['name' => 'Buku Ajar']);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $novelManuscript = $this->makeCompletedManuscript(null, 'Petualangan Senja');
        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$novelManuscript->id}",
            ['price' => 50000, 'book_category_id' => $novelCategory->id]
        );

        $textbookManuscript = $this->makeCompletedManuscript(null, 'Dasar Statistika');
        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$textbookManuscript->id}",
            ['price' => 50000, 'book_category_id' => $textbookCategory->id]
        );

        $filtered = $this->getJson("/api/v1/books?book_category_id={$novelCategory->id}");
        $titles = collect($filtered->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Petualangan Senja'));
        $this->assertFalse($titles->contains('Dasar Statistika'));

        $searched = $this->getJson('/api/v1/books?search=Statistika');
        $searchedTitles = collect($searched->json('data'))->pluck('title');

        $this->assertTrue($searchedTitles->contains('Dasar Statistika'));
        $this->assertFalse($searchedTitles->contains('Petualangan Senja'));

        // Pencarian tidak membedakan huruf besar/kecil.
        foreach (['dasar statistika', 'DASAR STATISTIKA'] as $keyword) {
            $titles = collect($this->getJson('/api/v1/books?search='.rawurlencode($keyword))->json('data'))->pluck('title');

            $this->assertTrue($titles->contains('Dasar Statistika'), "Pencarian '{$keyword}' harus menemukan buku.");
            $this->assertFalse($titles->contains('Petualangan Senja'));
        }
    }

    public function test_catalog_can_filter_by_ids_for_cart_lookup(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $manuscriptA = $this->makeCompletedManuscript(null, 'Buku Keranjang Satu');
        $bookA = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscriptA->id}",
            ['price' => 50000]
        )->json('data');

        $manuscriptB = $this->makeCompletedManuscript(null, 'Buku Keranjang Dua');
        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscriptB->id}",
            ['price' => 50000]
        );

        $manuscriptC = $this->makeCompletedManuscript(null, 'Buku Keranjang Tiga');
        $bookC = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscriptC->id}",
            ['price' => 50000]
        )->json('data');

        $response = $this->getJson("/api/v1/books?ids={$bookA['id']},{$bookC['id']}");
        $titles = collect($response->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Buku Keranjang Satu'));
        $this->assertTrue($titles->contains('Buku Keranjang Tiga'));
        $this->assertFalse($titles->contains('Buku Keranjang Dua'));
    }

    /*
    |--------------------------------------------------------------------------
    | Reviews
    |--------------------------------------------------------------------------
    */

    public function test_user_can_upsert_review_and_average_rating_updates(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        );
        $bookId = $response->json('data.id');

        $reviewer = $this->makeUser();
        Sanctum::actingAs($reviewer);

        $this->postJson("/api/v1/books/{$bookId}/reviews", [
            'rating' => 4,
            'comment' => 'Bagus',
        ])->assertStatus(201);

        $this->assertDatabaseHas('book_reviews', [
            'book_id' => $bookId,
            'user_id' => $reviewer->id,
            'rating' => 4,
        ]);

        // Upsert - same user reviewing again updates instead of duplicating.
        $this->postJson("/api/v1/books/{$bookId}/reviews", [
            'rating' => 5,
        ])->assertStatus(201);

        $this->assertSame(
            1,
            BookReview::where('book_id', $bookId)->count()
        );

        $bookSlug = Book::find($bookId)->slug;
        $show = $this->getJson("/api/v1/books/{$bookSlug}");
        $this->assertEquals(5, $show->json('data.reviews_avg_rating'));
    }

    /*
    |--------------------------------------------------------------------------
    | Preview Upload
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_upload_book_preview_and_it_is_publicly_accessible(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        );
        $bookId = $response->json('data.id');

        $uploadResponse = $this->postJson(
            "/api/v1/admin/books/{$bookId}/preview",
            ['file' => $this->pdf()]
        );

        $uploadResponse->assertStatus(200);
        $this->assertNotNull($uploadResponse->json('data.preview_url'));

        Storage::disk('public')->assertExists(
            $uploadResponse->json('data.preview_file')
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Preview PDF lewat API (untuk flipbook)
    |--------------------------------------------------------------------------
    */

    private function makeBookWithPreview(array $overrides = [], bool $storeFile = true): Book
    {
        $book = Book::create(array_merge([
            'title' => 'Buku Preview '.uniqid(),
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $this->makeUser(['admin'])->id,
            'preview_file' => 'books/1/preview.pdf',
        ], $overrides));

        if ($storeFile && $book->preview_file) {
            Storage::disk('public')->put($book->preview_file, '%PDF-1.4 isi uji');
        }

        return $book;
    }

    public function test_guest_can_read_the_preview_pdf_through_the_api_with_cors_headers(): void
    {
        $book = $this->makeBookWithPreview();

        // Berkas di /storage tidak membawa header CORS; rute API inilah yang
        // membuat PDF bisa dibaca PDF.js dari origin frontend.
        $response = $this->withHeaders(['Origin' => 'http://localhost:5173'])
            ->get("/api/v1/books/{$book->slug}/preview");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $response->assertHeader('Access-Control-Allow-Origin');
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
        $this->assertSame('%PDF-1.4 isi uji', $response->streamedContent());
    }

    public function test_preview_pdf_is_not_served_for_inactive_books_or_missing_previews(): void
    {
        $inactive = $this->makeBookWithPreview(['is_active' => false]);
        $withoutPreview = $this->makeBookWithPreview(['preview_file' => null]);
        $fileMissing = $this->makeBookWithPreview(['preview_file' => 'books/2/hilang.pdf'], storeFile: false);

        foreach ([$inactive, $withoutPreview, $fileMissing] as $book) {
            $this->get("/api/v1/books/{$book->slug}/preview")->assertNotFound();
        }

        $this->get('/api/v1/books/tidak-ada/preview')->assertNotFound();
    }

    public function test_stable_pdf_url_always_serves_the_current_preview(): void
    {
        $book = $this->makeBookWithPreview();

        $this->get("/api/v1/books/{$book->slug}/preview.pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        // Mengganti file preview tidak mengubah alamatnya.
        Storage::disk('public')->put('books/1/cuplikan.pdf', '%PDF-1.4 cuplikan');
        $book->update(['preview_file' => 'books/1/cuplikan.pdf']);

        $this->assertSame(
            '%PDF-1.4 cuplikan',
            $this->get("/api/v1/books/{$book->slug}/preview.pdf")->streamedContent()
        );
    }

    public function test_uploading_a_new_preview_deletes_the_previous_file(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        Sanctum::actingAs($this->makeUser(['admin']));

        $bookId = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        )->json('data.id');

        $first = $this->postJson("/api/v1/admin/books/{$bookId}/preview", ['file' => $this->pdf('buku-utuh.pdf')])
            ->assertOk()
            ->json('data.preview_file');
        $second = $this->postJson("/api/v1/admin/books/{$bookId}/preview", ['file' => $this->pdf('cuplikan.pdf')])
            ->assertOk()
            ->json('data.preview_file');

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
    }

    public function test_a_replaced_preview_file_is_kept_when_another_book_still_uses_it(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        Sanctum::actingAs($this->makeUser(['admin']));

        $bookId = $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        )->json('data.id');

        $shared = $this->postJson("/api/v1/admin/books/{$bookId}/preview", ['file' => $this->pdf()])
            ->json('data.preview_file');
        $this->makeBookWithPreview(['preview_file' => $shared], storeFile: false);

        $this->postJson("/api/v1/admin/books/{$bookId}/preview", ['file' => $this->pdf('baru.pdf')])
            ->assertOk();

        Storage::disk('public')->assertExists($shared);
    }

    public function test_replacing_a_chapter_preview_deletes_the_previous_file(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $book = Book::create([
            'title' => 'Kompilasi Uji',
            'price' => 100000,
            'discount' => 0,
            'is_chapter_compilation' => true,
            'created_by' => $admin->id,
        ]);
        $chapter = BookChapter::create([
            'book_id' => $book->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
            'price' => 50000,
        ]);

        $first = $this->postJson("/api/v1/admin/books/chapters/{$chapter->id}/preview", ['file' => $this->pdf('bab-utuh.pdf')])
            ->assertOk()
            ->json('data.preview_file');
        $second = $this->postJson("/api/v1/admin/books/chapters/{$chapter->id}/preview", ['file' => $this->pdf('bab-cuplikan.pdf')])
            ->assertOk()
            ->json('data.preview_file');

        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
    }

    public function test_google_scholar_url_must_be_a_real_web_address(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $payload = ['title' => 'Buku Scholar', 'authors' => ['Penulis'], 'price' => 100000];

        $this->postJson('/api/v1/admin/books/manual', $payload + ['google_scholar_url' => 'b'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('google_scholar_url');

        $this->postJson('/api/v1/admin/books/manual', $payload + ['google_scholar_url' => 'javascript:alert(1)'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('google_scholar_url');

        $this->postJson('/api/v1/admin/books/manual', $payload + [
            'google_scholar_url' => 'https://scholar.google.com/scholar?q=embedded+system',
        ])->assertStatus(201);
    }

    /*
    |--------------------------------------------------------------------------
    | Access Control
    |--------------------------------------------------------------------------
    */

    public function test_non_admin_cannot_publish_book(): void
    {
        $manuscript = $this->makeCompletedManuscript();
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson(
            "/api/v1/admin/books/from-manuscript/{$manuscript->id}",
            ['price' => 100000]
        )->assertStatus(403);
    }

    public function test_non_admin_cannot_manage_categories(): void
    {
        $user = $this->makeUser();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/book-categories', [
            'name' => 'Novel',
        ])->assertStatus(403);
    }

    public function test_public_can_list_categories(): void
    {
        BookCategory::create(['name' => 'Novel']);
        FieldCategory::create(['name' => 'Pendidikan']);

        $this->getJson('/api/v1/book-categories')->assertStatus(200);
        $this->getJson('/api/v1/field-categories')->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Slug Buku
    |--------------------------------------------------------------------------
    */

    public function test_book_gets_a_slug_generated_from_its_title_automatically(): void
    {
        $manuscript = $this->makeCompletedManuscript(null, 'Judul Naskah');

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Petualangan Di Tanah Jawa',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscript->user_id,
        ]);

        $this->assertSame('petualangan-di-tanah-jawa', $book->slug);
    }

    public function test_two_books_with_the_same_title_get_distinct_slugs(): void
    {
        $manuscriptA = $this->makeCompletedManuscript(null, 'Naskah A');
        $manuscriptB = $this->makeCompletedManuscript(null, 'Naskah B');

        $bookA = Book::create([
            'manuscript_id' => $manuscriptA->id,
            'title' => 'Judul Sama',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscriptA->user_id,
        ]);

        $bookB = Book::create([
            'manuscript_id' => $manuscriptB->id,
            'title' => 'Judul Sama',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscriptB->user_id,
        ]);

        $this->assertSame('judul-sama', $bookA->slug);
        $this->assertSame('judul-sama-1', $bookB->slug);
    }

    public function test_show_resolves_by_slug(): void
    {
        $manuscript = $this->makeCompletedManuscript(null, 'Buku Uji Slug');

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Slug',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscript->user_id,
        ]);

        $this->getJson("/api/v1/books/{$book->slug}")
            ->assertStatus(200)
            ->assertJsonPath('data.id', $book->id);
    }

    public function test_show_no_longer_resolves_by_numeric_id(): void
    {
        $manuscript = $this->makeCompletedManuscript(null, 'Buku Uji Slug Lain');

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Slug Lain',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscript->user_id,
        ]);

        $this->getJson("/api/v1/books/{$book->id}")->assertStatus(404);
    }

    /*
    |--------------------------------------------------------------------------
    | Author/Editor Profile Links di Detail Buku
    |--------------------------------------------------------------------------
    */

    public function test_show_exposes_author_profile_with_published_slug(): void
    {
        $penulis = $this->makeUser(['penulis']);
        PublicProfile::create([
            'user_id' => $penulis->id,
            'slug' => 'penulis-uji-slug',
            'pen_name' => 'Nama Pena Uji',
            'is_published' => true,
        ]);
        $manuscript = $this->makeCompletedManuscript($penulis);
        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $penulis->id,
            'position' => 1,
        ]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Link Penulis',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson("/api/v1/books/{$book->slug}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.author_profiles.0.name', $penulis->name);
        $response->assertJsonPath('data.author_profiles.0.public_profile.slug', 'penulis-uji-slug');
        $response->assertJsonPath('data.author_profiles.0.public_profile.is_published', true);
    }

    public function test_show_author_profile_is_null_when_no_public_profile(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $manuscript = $this->makeCompletedManuscript($penulis);
        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $penulis->id,
            'position' => 1,
        ]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Tanpa Profil',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson("/api/v1/books/{$book->slug}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.author_profiles.0.public_profile', null);
    }

    public function test_show_falls_back_to_manuscript_owner_when_no_author_links(): void
    {
        // makeCompletedManuscript() tidak membuat baris manuscript_authors,
        // meniru naskah lama sebelum fitur co-author ada.
        $penulis = $this->makeUser(['penulis']);
        $manuscript = $this->makeCompletedManuscript($penulis);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Naskah Lama',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson("/api/v1/books/{$book->slug}");

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data.author_profiles');
        $response->assertJsonPath('data.author_profiles.0.name', $penulis->name);
    }

    public function test_show_lists_all_co_authors_in_author_profiles(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $manuscript = $this->makeCompletedManuscript($penulisA);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $penulisA->id, 'position' => 1]);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $penulisB->id, 'position' => 2]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Dua Penulis Uji',
            'authors_text' => $penulisA->name.', '.$penulisB->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulisA->id,
        ]);

        $response = $this->getJson("/api/v1/books/{$book->slug}");

        $response->assertStatus(200);
        $names = collect($response->json('data.author_profiles'))->pluck('name');
        $this->assertSame([$penulisA->name, $penulisB->name], $names->all());
    }

    public function test_show_exposes_editor_profile_with_published_slug(): void
    {
        $editor = $this->makeUser(['editor']);
        PublicProfile::create([
            'user_id' => $editor->id,
            'slug' => 'editor-uji-slug',
            'pen_name' => 'Editor Pena Uji',
            'is_published' => true,
        ]);

        $manuscript = $this->makeCompletedManuscript();
        $manuscript->update(['editor_id' => $editor->id]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Link Editor',
            'authors_text' => 'Penulis Contoh',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $editor->id,
        ]);

        $response = $this->getJson("/api/v1/books/{$book->slug}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.editor_profile.name', $editor->name);
        $response->assertJsonPath('data.editor_profile.public_profile.slug', 'editor-uji-slug');
    }

    public function test_catalog_index_exposes_author_and_editor_profiles(): void
    {
        $penulis = $this->makeUser(['penulis']);
        PublicProfile::create([
            'user_id' => $penulis->id,
            'slug' => 'penulis-katalog-slug',
            'pen_name' => 'Penulis Katalog',
            'is_published' => true,
        ]);

        $editor = $this->makeUser(['editor']);
        PublicProfile::create([
            'user_id' => $editor->id,
            'slug' => 'editor-katalog-slug',
            'pen_name' => 'Editor Katalog',
            'is_published' => true,
        ]);

        $manuscript = $this->makeCompletedManuscript($penulis, 'Buku Katalog Uji');
        $manuscript->update(['editor_id' => $editor->id]);
        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $penulis->id,
            'position' => 1,
        ]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Katalog Uji',
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);

        $response = $this->getJson('/api/v1/books');

        $response->assertStatus(200);
        $row = collect($response->json('data'))->firstWhere('id', $book->id);
        $this->assertSame('penulis-katalog-slug', $row['author_profiles'][0]['public_profile']['slug']);
        $this->assertSame('editor-katalog-slug', $row['editor_profile']['public_profile']['slug']);
    }

    private function makeBookWithAuthorAndEditor(string $title): void
    {
        $penulis = $this->makeUser(['penulis']);
        PublicProfile::create([
            'user_id' => $penulis->id,
            'slug' => 'profil-'.uniqid(),
            'pen_name' => $penulis->name,
            'is_published' => true,
        ]);
        $editor = $this->makeUser(['editor']);
        $manuscript = $this->makeCompletedManuscript($penulis, $title);
        $manuscript->update(['editor_id' => $editor->id]);
        ManuscriptAuthor::create([
            'manuscript_id' => $manuscript->id,
            'user_id' => $penulis->id,
            'position' => 1,
        ]);

        Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => $title,
            'authors_text' => $penulis->name,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $penulis->id,
        ]);
    }

    public function test_catalog_index_query_count_does_not_scale_with_book_count(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->makeBookWithAuthorAndEditor('Buku N+1 Uji '.$i);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson('/api/v1/books')->assertStatus(200);
        $queryCountForThreeBooks = count(DB::getQueryLog());

        // Setup untuk buku ke-4 dilakukan SEBELUM flush kedua, supaya query
        // insert-nya tidak ikut terhitung di pengukuran "setelah" - hanya
        // query dari request GET /books yang dibandingkan.
        $this->makeBookWithAuthorAndEditor('Buku N+1 Uji Tambahan');

        DB::flushQueryLog();
        $this->getJson('/api/v1/books')->assertStatus(200);
        $queryCountForFourBooks = count(DB::getQueryLog());

        $this->assertSame($queryCountForThreeBooks, $queryCountForFourBooks);
    }
}
