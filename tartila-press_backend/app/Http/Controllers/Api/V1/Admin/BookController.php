<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Manuscript;
use App\Support\Languages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BookController extends Controller
{
    private const BOOK_FIELD_RULES = [
        'isbn' => ['nullable', 'string', 'max:255'],
        'front_cover' => ['nullable', 'string', 'max:500'],
        'back_cover' => ['nullable', 'string', 'max:500'],
        'cover_layout_designer' => ['nullable', 'string', 'max:255'],
        'description' => ['nullable', 'string'],
        'book_category_id' => ['nullable', 'integer', 'exists:book_categories,id'],
        'field_category_id' => ['nullable', 'integer', 'exists:field_categories,id'],
        'price' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
        'royalty_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
        'citation_publisher' => ['nullable', 'string', 'max:255'],
        'citation_publication_date' => ['nullable', 'date'],
        'google_scholar_url' => ['nullable', 'url:http,https', 'max:500'],
        'is_active' => ['nullable', 'boolean'],
    ];

    /*
    |--------------------------------------------------------------------------
    | Index - Semua buku termasuk yang nonaktif
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $books = Book::with(['category', 'fieldCategory', 'chapters', 'manuscript.editor', 'ownerEditor'])
            ->latest()
            ->get()
            ->makeVisible('royalty_percentage');

        return response()->json([
            'success' => true,
            'message' => 'Daftar buku berhasil diambil.',
            'data' => $books,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store From Manuscript - Terbitkan naskah selesai jadi buku
    |--------------------------------------------------------------------------
    */

    public function storeFromManuscript(Request $request, Manuscript $manuscript): JsonResponse
    {
        abort_unless(
            $manuscript->status === 'completed',
            422,
            'Naskah harus berstatus selesai sebelum diterbitkan.'
        );

        abort_if(
            $manuscript->book()->exists() || $manuscript->bookChapter()->exists(),
            422,
            'Naskah ini sudah pernah diterbitkan.'
        );

        $validated = $request->validate([
            ...self::BOOK_FIELD_RULES,
            ...Languages::rules(),
        ]);

        $book = Book::create([
            ...$validated,
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'authors' => $manuscript->authors,
            'authors_text' => implode(', ', $manuscript->authors),
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Buku berhasil diterbitkan dari naskah.',
            'data' => $book,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Store Manual - Admin input buku sendiri (tanpa naskah)
    |--------------------------------------------------------------------------
    */

    public function storeManual(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'authors' => ['required', 'array', 'min:1'],
            'authors.*' => ['string', 'max:255'],
            ...self::BOOK_FIELD_RULES,
            ...Languages::rules(),
        ]);

        $book = Book::create([
            ...$validated,
            'authors_text' => implode(', ', $validated['authors']),
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Buku berhasil ditambahkan.',
            'data' => $book,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Book $book): JsonResponse
    {
        $rules = [...self::BOOK_FIELD_RULES, ...Languages::rules()];
        $rules['price'] = ['sometimes', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT];

        if (! $book->manuscript_id) {
            $rules['title'] = ['sometimes', 'required', 'string', 'max:255'];
            $rules['authors'] = ['sometimes', 'array', 'min:1'];
            $rules['authors.*'] = ['string', 'max:255'];
        }

        $validated = $request->validate($rules);

        if (isset($validated['authors'])) {
            $validated['authors_text'] = implode(', ', $validated['authors']);
        }

        $book->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Buku berhasil diperbarui.',
            'data' => $book,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy
    |--------------------------------------------------------------------------
    */

    public function destroy(Book $book): JsonResponse
    {
        $book->delete();

        return response()->json([
            'success' => true,
            'message' => 'Buku berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Preview - PDF preview publik untuk seluruh buku
    |--------------------------------------------------------------------------
    */

    public function uploadPreview(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $previous = $book->preview_file;
        $path = $validated['file']->store('books/'.$book->id, 'public');

        $book->update(['preview_file' => $path]);

        $this->deleteReplacedPreview($previous, $path);

        return response()->json([
            'success' => true,
            'message' => 'Preview buku berhasil diunggah.',
            'data' => $book->fresh(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Combine Chapters - Gabungkan beberapa naskah jadi 1 buku Book Chapter
    |--------------------------------------------------------------------------
    */

    public function combineChapters(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'manuscript_ids' => ['required', 'array', 'min:2'],
            'manuscript_ids.*' => ['integer', 'distinct'],
            ...self::BOOK_FIELD_RULES,
            ...Languages::rules(),
        ]);

        $manuscripts = Manuscript::whereIn('id', $validated['manuscript_ids'])
            ->with('user')
            ->get();

        abort_unless(
            $manuscripts->count() === count($validated['manuscript_ids']),
            422,
            'Salah satu naskah tidak ditemukan.'
        );

        foreach ($manuscripts as $manuscript) {
            abort_unless(
                $manuscript->status === 'completed',
                422,
                "Naskah \"{$manuscript->title}\" belum berstatus selesai."
            );

            abort_if(
                $manuscript->book()->exists() || $manuscript->bookChapter()->exists(),
                422,
                "Naskah \"{$manuscript->title}\" sudah pernah diterbitkan."
            );
        }

        $book = DB::transaction(function () use ($request, $validated, $manuscripts) {
            $bookFields = collect($validated)
                ->except(['title', 'manuscript_ids'])
                ->toArray();

            $book = Book::create([
                ...$bookFields,
                'title' => $validated['title'],
                'authors' => $manuscripts->map(fn (Manuscript $m) => $m->user->name)->values()->all(),
                'authors_text' => $manuscripts->map(fn (Manuscript $m) => $m->user->name)->implode(', '),
                'is_chapter_compilation' => true,
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['manuscript_ids'] as $index => $manuscriptId) {
                $manuscript = $manuscripts->firstWhere('id', $manuscriptId);

                BookChapter::create([
                    'book_id' => $book->id,
                    'manuscript_id' => $manuscriptId,
                    'chapter_number' => $index + 1,
                    'title' => $manuscript->title,
                ]);
            }

            return $book;
        });

        return response()->json([
            'success' => true,
            'message' => 'Buku Book Chapter berhasil dibuat.',
            'data' => $book->load('chapters.manuscript.user'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Chapter Preview - PDF preview publik per bab
    |--------------------------------------------------------------------------
    */

    public function uploadChapterPreview(Request $request, BookChapter $chapter): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $previous = $chapter->preview_file;
        $path = $validated['file']->store('books/'.$chapter->book_id.'/chapters', 'public');

        $chapter->update(['preview_file' => $path]);

        $this->deleteReplacedPreview($previous, $path);

        return response()->json([
            'success' => true,
            'message' => 'Preview bab berhasil diunggah.',
            'data' => $chapter->fresh(),
        ]);
    }

    /**
     * Hapus file preview yang baru saja diganti. Tanpa ini file lama (mis.
     * PDF buku utuh yang diganti dengan cuplikan) tetap terbuka publik di
     * alamat lamanya. Tidak dihapus bila masih dipakai buku/bab lain.
     */
    private function deleteReplacedPreview(?string $previous, string $current): void
    {
        if (! $previous || $previous === $current) {
            return;
        }

        $stillUsed = Book::where('preview_file', $previous)->exists()
            || BookChapter::where('preview_file', $previous)->exists();

        if (! $stillUsed) {
            Storage::disk('public')->delete($previous);
        }
    }
}
