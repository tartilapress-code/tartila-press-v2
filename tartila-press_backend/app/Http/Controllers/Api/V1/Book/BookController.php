<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
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

        $books = $query->get()->append(['author_profiles', 'editor_profile']);

        return response()->json([
            'success' => true,
            'message' => 'Daftar buku berhasil diambil.',
            'data' => $books,
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
