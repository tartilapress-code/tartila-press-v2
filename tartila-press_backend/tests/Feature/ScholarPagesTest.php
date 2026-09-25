<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ScholarPagesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin Uji',
            'email' => uniqid('admin').'@example.com',
            'password' => 'Tartila@2026',
        ]);
    }

    private function makeBook(array $overrides = []): Book
    {
        return Book::create(array_merge([
            'title' => 'Embedded System',
            // Gelar tersimpan sebagai entri sendiri, seperti pada data asli.
            'authors' => ['Rahima Tartila', 'S.T'],
            'authors_text' => 'Rahima Tartila, S.T',
            'isbn' => '978-634-05-2943-2',
            'description' => str_repeat('Buku ini membahas sistem tertanam dari dasar hingga penerapannya. ', 3),
            'price' => 600000,
            'discount' => 0,
            'citation_publisher' => 'Tartila Press',
            'citation_publication_date' => '2026-08-27',
            'preview_file' => 'books/1/cuplikan.pdf',
            'is_active' => true,
            'created_by' => $this->admin->id,
        ], $overrides));
    }

    /*
    |--------------------------------------------------------------------------
    | Halaman abstrak: tag sitasi ada di HTML dari server
    |--------------------------------------------------------------------------
    */

    public function test_abstract_page_serves_citation_meta_tags_in_the_html(): void
    {
        $book = $this->makeBook();

        $response = $this->get("/api/abstrak/{$book->slug}");

        $response->assertOk();
        $response->assertSee('<meta name="citation_title" content="Embedded System">', false);
        $response->assertSee('<meta name="citation_author" content="Rahima Tartila">', false);
        $response->assertSee('<meta name="citation_publication_date" content="2026/08/27">', false);
        $response->assertSee('<meta name="citation_publisher" content="Tartila Press">', false);
        $response->assertSee('<meta name="citation_isbn" content="978-634-05-2943-2">', false);
        $response->assertSee('<meta name="citation_language" content="id">', false);
        $response->assertSee(
            '<meta name="citation_pdf_url" content="'.route('scholar.pdf', $book).'">',
            false
        );
        $response->assertSee(
            '<meta name="citation_abstract_html_url" content="'.route('scholar.abstract', $book).'">',
            false
        );
        $response->assertDontSee('noindex', false);
        $response->assertSee('application/ld+json', false);
    }

    public function test_a_degree_stored_as_its_own_author_entry_is_not_a_second_author(): void
    {
        $book = $this->makeBook();

        $content = $this->get("/api/abstrak/{$book->slug}")->getContent();

        $this->assertSame(1, substr_count($content, 'name="citation_author"'));
        $this->assertStringNotContainsString('content="S.T"', $content);
    }

    public function test_pdf_tag_points_to_the_stable_pdf_url_and_is_left_out_without_a_preview(): void
    {
        $withPreview = $this->makeBook(['title' => 'Dengan Preview']);
        $withoutPreview = $this->makeBook(['title' => 'Tanpa Preview', 'preview_file' => null]);

        $this->get("/api/abstrak/{$withPreview->slug}")
            ->assertSee("/api/abstrak/{$withPreview->slug}.pdf", false);

        $this->get("/api/abstrak/{$withoutPreview->slug}")
            ->assertOk()
            ->assertDontSee('citation_pdf_url', false);
    }

    public function test_the_pdf_is_in_the_same_directory_as_the_abstract_page(): void
    {
        // Aturan Google Scholar: citation_pdf_url harus menunjuk berkas di
        // sub-direktori yang sama dengan halaman abstraknya.
        $book = $this->makeBook();

        $content = $this->get("/api/abstrak/{$book->slug}")->getContent();

        $this->assertSame(1, preg_match('/name="citation_pdf_url" content="([^"]+)"/', $content, $match));

        $abstractUrl = parse_url(route('scholar.abstract', $book));
        $pdfUrl = parse_url($match[1]);

        $this->assertSame($abstractUrl['host'], $pdfUrl['host']);
        $this->assertSame(dirname($abstractUrl['path']), dirname($pdfUrl['path']));
    }

    public function test_the_pdf_next_to_the_abstract_page_serves_the_current_preview(): void
    {
        Storage::fake('public');
        $book = $this->makeBook(['preview_file' => 'books/1/cuplikan.pdf']);
        Storage::disk('public')->put('books/1/cuplikan.pdf', '%PDF-1.4 cuplikan');

        $response = $this->get("/api/abstrak/{$book->slug}.pdf");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
        $this->assertSame('%PDF-1.4 cuplikan', $response->streamedContent());

        // ".pdf" tidak boleh mengganggu halaman abstrak itu sendiri.
        $this->get("/api/abstrak/{$book->slug}")
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8');
    }

    public function test_the_pdf_next_to_the_abstract_page_is_not_served_for_inactive_books_or_missing_previews(): void
    {
        Storage::fake('public');
        $inactive = $this->makeBook(['title' => 'Nonaktif', 'is_active' => false]);
        $withoutPreview = $this->makeBook(['title' => 'Tanpa Berkas', 'preview_file' => null]);
        $fileMissing = $this->makeBook(['title' => 'Berkas Hilang', 'preview_file' => 'books/9/hilang.pdf']);
        Storage::disk('public')->put('books/1/cuplikan.pdf', '%PDF-1.4 cuplikan');

        foreach ([$inactive, $withoutPreview, $fileMissing] as $book) {
            $this->get("/api/abstrak/{$book->slug}.pdf")->assertNotFound();
        }

        $this->get('/api/abstrak/tidak-ada.pdf')->assertNotFound();
    }

    public function test_abstract_page_shows_the_abstract_and_links_to_the_store_page(): void
    {
        config(['app.frontend_url' => 'https://tartilapress.example']);
        $book = $this->makeBook();

        $this->get("/api/abstrak/{$book->slug}")
            ->assertSee('Abstrak')
            ->assertSee('Buku ini membahas sistem tertanam')
            ->assertSee('href="https://tartilapress.example/buku/'.$book->slug.'"', false)
            ->assertSee('27 Agustus 2026');
    }

    public function test_abstract_page_escapes_everything_that_comes_from_the_database(): void
    {
        $book = $this->makeBook([
            'title' => 'Judul <b>tebal</b> & "kutip"',
            'authors' => ['Ani <i>Miring</i>'],
            'description' => str_repeat('Abstrak <img src=x onerror=alert(1)> ', 6).'</script><script>alert(1)</script>',
        ]);

        $content = $this->get("/api/abstrak/{$book->slug}")->assertOk()->getContent();

        $this->assertStringNotContainsString('<b>tebal</b>', $content);
        $this->assertStringNotContainsString('<i>Miring</i>', $content);
        $this->assertStringNotContainsString('<img src=x', $content);
        $this->assertStringNotContainsString('<script>alert(1)</script>', $content);
        // Di dalam JSON-LD tanda < dan > ditulis sebagai < dan >.
        $this->assertStringContainsString('<', $content);
    }

    public function test_incomplete_books_are_noindex_and_carry_no_citation_tags(): void
    {
        $noDate = $this->makeBook(['title' => 'Tanpa Tanggal', 'citation_publication_date' => null]);
        $noAuthor = $this->makeBook(['title' => 'Tanpa Penulis', 'authors' => [], 'authors_text' => null]);
        $shortAbstract = $this->makeBook(['title' => 'Abstrak Pendek', 'description' => 'Terlalu singkat.']);

        foreach ([$noDate, $noAuthor, $shortAbstract] as $book) {
            $this->get("/api/abstrak/{$book->slug}")
                ->assertOk()
                ->assertSee('<meta name="robots" content="noindex, nofollow">', false)
                ->assertDontSee('citation_title', false);
        }
    }

    public function test_inactive_or_unknown_books_have_no_abstract_page(): void
    {
        $inactive = $this->makeBook(['is_active' => false]);

        $this->get("/api/abstrak/{$inactive->slug}")->assertNotFound();
        $this->get('/api/abstrak/tidak-ada')->assertNotFound();
    }

    public function test_authors_fall_back_to_the_manuscript_authors_when_the_book_has_none(): void
    {
        $author = User::create([
            'name' => 'Penulis Naskah',
            'email' => uniqid('penulis').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $author->id,
            'status' => 'confirmed',
            'subtotal' => 1000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 1000,
        ]);
        $manuscript = Manuscript::create([
            'order_id' => $order->id,
            'user_id' => $author->id,
            'title' => 'Naskah',
            'authors' => [],
            'status' => 'completed',
        ]);
        $book = $this->makeBook([
            'authors' => [],
            'authors_text' => null,
            'manuscript_id' => $manuscript->id,
        ]);

        $this->assertSame(['Penulis Naskah'], $book->fresh()->citation_authors);
        $this->get("/api/abstrak/{$book->slug}")
            ->assertSee('<meta name="citation_author" content="Penulis Naskah">', false);
    }

    /*
    |--------------------------------------------------------------------------
    | Katalog: tautan HTML biasa ke buku yang siap diindeks
    |--------------------------------------------------------------------------
    */

    public function test_catalog_lists_only_scholar_ready_books_as_plain_links(): void
    {
        $ready = $this->makeBook(['title' => 'Buku Siap']);
        $this->makeBook(['title' => 'Tanpa Tanggal', 'citation_publication_date' => null]);
        $this->makeBook(['title' => 'Abstrak Pendek', 'description' => 'Singkat.']);
        $this->makeBook(['title' => 'Buku Nonaktif', 'is_active' => false]);

        $response = $this->get('/api/katalog');

        $response->assertOk();
        $response->assertSee('href="'.route('scholar.abstract', $ready).'"', false);
        $response->assertSee('Buku Siap');
        $response->assertSee('Rahima Tartila · 2026');
        $response->assertDontSee('Tanpa Tanggal');
        $response->assertDontSee('Abstrak Pendek');
        $response->assertDontSee('Buku Nonaktif');
        $response->assertDontSee('<meta name="robots"', false);
    }

    public function test_catalog_tells_when_no_book_is_ready(): void
    {
        $this->get('/api/katalog')
            ->assertOk()
            ->assertSee('Belum ada buku yang siap ditampilkan.');
    }

    public function test_catalog_is_paginated_with_plain_html_links(): void
    {
        foreach (range(1, 101) as $number) {
            $this->makeBook(['title' => sprintf('Buku %03d', $number)]);
        }

        $this->get('/api/katalog')
            ->assertOk()
            ->assertSee('Halaman 1 dari 2')
            ->assertSee('rel="next"', false)
            ->assertSee('halaman=2', false);

        $this->get('/api/katalog?halaman=2')
            ->assertOk()
            ->assertSee('Halaman 2 dari 2')
            ->assertSee('rel="prev"', false);

        $this->get('/api/katalog?halaman=3')->assertNotFound();
    }

    /*
    |--------------------------------------------------------------------------
    | API detail buku memuat nama penulis untuk sitasi yang sudah bersih
    |--------------------------------------------------------------------------
    */

    public function test_book_api_exposes_clean_citation_authors(): void
    {
        $book = $this->makeBook();

        $this->getJson("/api/v1/books/{$book->slug}")
            ->assertOk()
            ->assertJsonPath('data.citation_authors', ['Rahima Tartila']);
    }
}
