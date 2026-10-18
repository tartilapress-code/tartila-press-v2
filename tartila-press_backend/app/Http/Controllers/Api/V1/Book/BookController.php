<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Katalog buku publik (search, filter, sort)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $query = Book::with([
            'category',
            'fieldCategory',
            'manuscript.editor.publicProfile',
            'manuscript.user.publicProfile',
            'manuscript.authorLinks.user.publicProfile',
            'ownerEditor.publicProfile',
        ])
            ->withAvg('reviews', 'rating')
            ->where('is_active', true);

        if ($request->filled('ids')) {
            $ids = array_filter(explode(',', (string) $request->query('ids')));
            $query->whereIn('id', $ids);
        }

        if ($request->filled('search')) {
            // LIKE biasa membedakan huruf besar/kecil di PostgreSQL, jadi
            // dua sisi diubah ke huruf kecil supaya "embedded" menemukan
            // "Embedded System" di semua database.
            $term = '%'.mb_strtolower((string) $request->query('search')).'%';

            $query->where(function ($query) use ($term) {
                $query->whereRaw('LOWER(title) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(authors_text) LIKE ?', [$term]);
            });
        }

        if ($request->filled('book_category_id')) {
            $query->where('book_category_id', $request->query('book_category_id'));
        }

        if ($request->filled('field_category_id')) {
            $query->where('field_category_id', $request->query('field_category_id'));
        }

        match ($request->query('sort')) {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            'rating' => $query->orderByDesc('reviews_avg_rating'),
            default => $query->latest(),
        };

        // Urutan stabil antarhalaman (judul/harga/waktu bisa sama).
        $query->orderByDesc('id');

        // Rekomendasi (maksimal 3, dipin admin) paling atas.
        $recommendations = app(RecommendationService::class);
        $recommendations->pinFirst($query, 'book', 'books.id');

        // Per halaman (bawaan 24; beranda cukup ?per_page=4).
        $books = $query->paginate($this->perPage($request, 24));
        $books->getCollection()->append(['author_profiles', 'editor_profile']);
        $recommendations->markRecommended($books->getCollection(), 'book');

        return $this->pageResponse($books, 'Daftar buku berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Hero Covers - Sampul terbaru untuk tumpukan buku di hero beranda
    |--------------------------------------------------------------------------
    | Buku aktif dengan sampul depan berupa tautan gambar, terbaru diunggah
    | lebih dulu (yang paling depan di tumpukan), beserta penulis dan
    | kategorinya untuk keterangan buku terbitan terbaru.
    */

    public function heroCovers(): JsonResponse
    {
        $covers = Book::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->where('front_cover', 'like', 'http://%')
                ->orWhere('front_cover', 'like', 'https://%'))
            ->orderByDesc('front_cover_updated_at')
            ->orderByDesc('id')
            ->limit(5)
            ->with('category:id,name')
            ->get(['id', 'title', 'slug', 'front_cover', 'authors', 'authors_text', 'book_category_id'])
            ->map(fn (Book $book) => [
                'id' => $book->id,
                'title' => $book->title,
                'slug' => $book->slug,
                'front_cover' => $book->front_cover,
                // Untuk keterangan "Terbitan Terbaru" di bawah tumpukan.
                'authors' => $book->authors_text ?: (implode(', ', array_filter((array) $book->authors)) ?: null),
                'category' => $book->category?->name,
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Sampul terbaru berhasil diambil.',
            'data' => $covers,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail buku publik
    |--------------------------------------------------------------------------
    */

    public function show(Book $book): JsonResponse
    {
        abort_unless($book->is_active, 404, 'Buku tidak ditemukan.');

        $book->load([
            'category',
            'fieldCategory',
            'manuscript.editor.publicProfile',
            'manuscript.user.publicProfile',
            'manuscript.authorLinks.user.publicProfile',
            'ownerEditor.publicProfile',
            'chapters.manuscript.user.publicProfile',
            'reviews.user',
        ]);

        $book->loadAvg('reviews', 'rating');
        $book->append(['author_profiles', 'editor_profile', 'citation_authors']);

        // Pembelian ebook diarahkan ke Tartila Book (alamat situs + judul buku).
        if ($book->sells_ebook) {
            $book->setAttribute('ebook_url', $book->ebookUrl());
            $book->setAttribute('ebook_available', $book->isEbookAvailable());
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail buku berhasil diambil.',
            'data' => $book,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Preview - PDF preview buku, disajikan lewat API
    |--------------------------------------------------------------------------
    |
    | Berkas di /storage disajikan langsung oleh web server tanpa header CORS,
    | sehingga browser tidak bisa membacanya lewat fetch dari origin frontend
    | (dibutuhkan PDF.js untuk flipbook). Rute API ini melewati middleware
    | CORS yang sama seperti endpoint lainnya.
    |
    */

    public function preview(Book $book): StreamedResponse
    {
        $disk = Storage::disk('public');

        abort_unless(
            $book->is_active
                && $book->preview_file
                && $disk->exists($book->preview_file),
            404,
            'Preview buku tidak tersedia.'
        );

        return $disk->response(
            $book->preview_file,
            Str::slug($book->title).'.pdf',
            ['Content-Type' => 'application/pdf']
        );
    }
}
