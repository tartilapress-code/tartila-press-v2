<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Book\MyPublishedBookController;
use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\User;
use App\Services\Notifier;
use App\Services\Reader\ReaderUpdateNotifier;
use App\Support\PdfPages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ebook lengkap buku (PDF/EPUB). Disimpan privat; hanya penulis buku yang
 * bisa mengunduh dari "Buku Terbit". Ebook PDF juga dibaca di Tartila Book
 * (admin tidak perlu mengunggah lagi di sana).
 */
class BookEbookController extends Controller
{
    // Sama dengan batas unggah nginx/php-fpm di server (210M).
    private const MAX_KB = 204800;

    public function __construct(
        private readonly Notifier $notifier,
        private readonly ReaderUpdateNotifier $reader,
    ) {}

    public function store(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'extensions:pdf,epub',
                'mimetypes:application/pdf,application/epub+zip,application/zip',
                'max:'.self::MAX_KB,
            ],
            // Dibaca peramban dari PDF; cadangannya dihitung server.
            'page_count' => ['nullable', 'integer', 'min:1', 'max:20000'],
        ], [
            'file.extensions' => 'Ebook harus berupa PDF atau EPUB.',
            'file.mimetypes' => 'Ebook harus berupa PDF atau EPUB.',
            'file.max' => 'Ukuran ebook maksimal 200 MB.',
        ]);

        $file = $validated['file'];
        $previous = $book->ebook_file;
        $path = $file->storeAs(
            'ebooks/'.$book->id,
            bin2hex(random_bytes(16)).'.'.strtolower($file->getClientOriginalExtension()),
            'local'
        );

        $isPdf = strtolower($file->getClientOriginalExtension()) === 'pdf';

        $book->forceFill([
            'ebook_file' => $path,
            'ebook_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'ebook_uploaded_at' => now(),
            'ebook_pages' => $isPdf ? ($validated['page_count'] ?? PdfPages::count(Storage::disk('local')->path($path))) : null,
        ])->save();

        if ($previous && $previous !== $path) {
            Storage::disk('local')->delete($previous);
        }

        $this->notifyAuthors($book, $previous === null);

        if ($previous !== null) {
            $this->reader->ebookReplaced($book);
        }

        return response()->json([
            'success' => true,
            'message' => 'Ebook berhasil diunggah.',
            'data' => $this->summary($book),
        ]);
    }

    public function destroy(Book $book): JsonResponse
    {
        if ($book->ebook_file) {
            Storage::disk('local')->delete($book->ebook_file);
        }

        $book->forceFill(['ebook_file' => null, 'ebook_name' => null, 'ebook_uploaded_at' => null, 'ebook_pages' => null])->save();

        return response()->json([
            'success' => true,
            'message' => 'Ebook berhasil dihapus.',
            'data' => $this->summary($book),
        ]);
    }

    public function download(Book $book): Response
    {
        return MyPublishedBookController::ebookResponse($book);
    }

    /** @return array<string, mixed> */
    private function summary(Book $book): array
    {
        return [
            'id' => $book->id,
            'has_ebook' => $book->hasEbook(),
            'ebook_name' => $book->ebook_name,
            'ebook_uploaded_at' => $book->ebook_uploaded_at,
            'ebook_pages' => $book->ebook_pages,
            'in_tartila_book' => $book->hasReadableEbook(),
        ];
    }

    private function notifyAuthors(Book $book, bool $isNew): void
    {
        if (! $book->is_active) {
            return;
        }

        $this->notifier->guard(function () use ($book, $isNew) {
            $this->notifier->notify(
                $this->authors($book),
                'book',
                $isNew ? 'Ebook lengkap tersedia' : 'Ebook lengkap diperbarui',
                $book->title,
                '/dashboard/buku-terbit',
                ['subject_type' => 'book', 'subject_id' => $book->id]
            );
        });
    }

    /**
     * Penulis buku (sama dengan Book::scopePublishedByAuthor): pengaju dan
     * penulis bersama naskahnya, atau naskah semua bab Book Chapter.
     *
     * @return Collection<int, User>
     */
    private function authors(Book $book): Collection
    {
        $book->loadMissing(['manuscript.user', 'manuscript.authorLinks.user', 'chapters.manuscript.user', 'chapters.manuscript.authorLinks.user']);

        return collect([$book->manuscript])
            ->merge($book->chapters->pluck('manuscript'))
            ->filter()
            ->flatMap(fn ($manuscript) => [$manuscript->user, ...$manuscript->authorLinks->pluck('user')])
            ->filter()
            ->unique('id')
            ->values();
    }
}
