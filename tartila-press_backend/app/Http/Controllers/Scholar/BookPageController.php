<?php

namespace App\Http\Controllers\Scholar;

use App\Http\Controllers\Controller;
use App\Models\Book;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Halaman HTML biasa (dirender di server) untuk mesin pencari ilmiah seperti
 * Google Scholar. Aplikasi web utama adalah SPA yang metadatanya baru muncul
 * setelah JavaScript berjalan; robot Scholar tidak dijamin menjalankannya,
 * jadi tiap buku punya halaman abstrak dengan tag `citation_*` di HTML, dan
 * daftar buku berisi tautan HTML biasa supaya robot bisa menemukannya.
 */
class BookPageController extends Controller
{
    private const PER_PAGE = 100;

    /*
    |--------------------------------------------------------------------------
    | Katalog - daftar buku yang siap diindeks (tautan HTML biasa)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): View
    {
        $books = Book::scholarCandidates()
            ->with(['manuscript.user', 'manuscript.authorLinks.user'])
            ->orderByDesc('citation_publication_date')
            ->orderBy('title')
            ->get()
            ->filter(fn (Book $book) => $book->isScholarReady())
            ->values();

        $lastPage = max(1, (int) ceil($books->count() / self::PER_PAGE));
        $page = max(1, (int) $request->query('halaman', 1));

        abort_if($page > $lastPage, 404);

        return view('scholar.catalog', [
            'books' => $books->forPage($page, self::PER_PAGE),
            'total' => $books->count(),
            'page' => $page,
            'lastPage' => $lastPage,
            'frontendUrl' => $this->frontendUrl(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Abstrak - satu buku: metadata sitasi, abstrak, dan tautan PDF/toko
    |--------------------------------------------------------------------------
    */

    public function show(Book $book): View
    {
        abort_unless($book->is_active, 404, 'Buku tidak ditemukan.');

        $book->load([
            'category',
            'fieldCategory',
            'manuscript.user',
            'manuscript.authorLinks.user',
        ]);

        return view('scholar.abstract', [
            'book' => $book,
            'authors' => $book->citation_authors,
            // Buku yang datanya belum lengkap tetap bisa dibuka, tetapi tanpa
            // tag sitasi dan dengan noindex agar tidak diindeks setengah jadi.
            'ready' => $book->isScholarReady(),
            'frontendUrl' => $this->frontendUrl(),
        ]);
    }

    private function frontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }
}
