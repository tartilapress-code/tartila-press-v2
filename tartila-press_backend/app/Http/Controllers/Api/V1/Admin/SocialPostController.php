<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Support\AuthorNames;
use App\Support\BookCoverImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Data untuk pembuat poster sosmed (khusus admin). Poster digambar di
 * browser; backend hanya menyediakan data buku terbit dan meneruskan foto
 * cover lewat domain yang sama supaya kanvas tidak "tercemar" lintas-origin
 * dan bisa diekspor sebagai PNG.
 */
class SocialPostController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Books - Buku terbit (aktif) beserta data yang dipakai poster dan caption
    |--------------------------------------------------------------------------
    */

    public function books(Request $request): JsonResponse
    {
        // Per halaman (terbaru dulu): ?search= judul/penulis.
        $books = Book::with('manuscript')
            ->where('is_active', true)
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.mb_strtolower((string) $request->query('search')).'%';

                $query->where(fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(authors_text) LIKE ?', [$term]));
            })
            ->latest()
            ->orderByDesc('id')
            ->paginate($this->perPage($request, 24));

        return $this->pageResponse($books, 'Daftar buku terbit berhasil diambil.', fn (Book $book) => [
            'id' => $book->id,
            'title' => $book->title,
            'authors' => $this->authors($book),
            'isbn' => $book->isbn,
            'price' => (float) $book->price,
            'final_price' => (float) $book->final_price,
            'description' => $book->description,
            'url' => rtrim((string) config('app.frontend_url'), '/').'/buku/'.$book->slug,
            'has_cover' => filled($book->front_cover),
            'is_chapter_compilation' => (bool) $book->is_chapter_compilation,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Cover - Foto cover buku (diteruskan dari penyimpanan / URL aslinya)
    |--------------------------------------------------------------------------
    */

    public function cover(Book $book): Response
    {
        $image = BookCoverImage::load($book);

        return response($image['bytes'], 200, [
            'Content-Type' => $image['mime'],
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    /**
     * Nama penulis: kolom authors buku, atau naskahnya. Teks bebas dipisah di
     * ";", "&", "dan" -- bukan di koma, karena koma dipakai untuk gelar
     * ("Rahima Tartila, S.T").
     *
     * @return list<string>
     */
    private function authors(Book $book): array
    {
        $names = is_array($book->authors) && $book->authors !== []
            ? $book->authors
            : (is_array($book->manuscript?->authors) && $book->manuscript->authors !== []
                ? $book->manuscript->authors
                : preg_split('/\s*(?:;|&|
|\sdan\s)\s*/i', (string) $book->authors_text, -1, PREG_SPLIT_NO_EMPTY));

        // Gelar yang terpisah jadi entri sendiri (["Rahima Tartila", "S.T"])
        // digabung kembali ke nama sebelumnya, bukan dihitung penulis kedua.
        $result = [];

        foreach (array_map('trim', $names) as $name) {
            if ($name === '') {
                continue;
            }

            if ($result !== [] && AuthorNames::fromText($name) === []) {
                $result[array_key_last($result)] .= ', '.$name;

                continue;
            }

            $result[] = $name;
        }

        return $result;
    }
}
