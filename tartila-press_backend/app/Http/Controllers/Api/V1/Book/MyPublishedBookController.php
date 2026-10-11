<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\HkiRecord;
use App\Services\CertificateService;
use App\Services\HkiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Buku Terbit" penulis: buku yang sudah terbit beserta ebook lengkapnya,
 * sertifikat HKI (bila paketnya memuat HKI) dan sertifikat penulis.
 */
class MyPublishedBookController extends Controller
{
    public function __construct(
        private readonly CertificateService $certificates,
        private readonly HkiService $hki,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $authorCertificates = $this->certificates->listFor($user)
            ->filter(fn (Certificate $certificate) => $certificate->type === Certificate::TYPE_PUBLICATION
                && $certificate->role === CertificateTemplate::ROLE_AUTHOR)
            ->keyBy('book_id');
        $hasAuthorTemplate = CertificateTemplate::resolveForPublication(CertificateTemplate::ROLE_AUTHOR) !== null;

        $books = Book::publishedByAuthor($user->id)
            ->with(['category:id,name', 'manuscript'])
            ->latest()
            ->get()
            ->map(function (Book $book) use ($authorCertificates, $hasAuthorTemplate) {
                $hki = $this->hki->forBook($book);
                /** @var HkiRecord|null $record */
                $record = $hki['record'];
                $certificate = $authorCertificates->get($book->id);

                return [
                    'id' => $book->id,
                    'title' => $book->title,
                    'slug' => $book->slug,
                    'authors' => $book->authors_text ?: implode(', ', (array) $book->authors),
                    'front_cover' => $book->front_cover,
                    'isbn' => $book->isbn,
                    'published_at' => $book->citation_publication_date?->toDateString(),
                    'category' => $book->category?->name,
                    'is_book_chapter' => (bool) ($book->is_chapter_offering || $book->is_chapter_compilation),
                    'ebook' => $book->hasEbook() ? [
                        'name' => $book->ebook_name,
                        'uploaded_at' => $book->ebook_uploaded_at,
                    ] : null,
                    'hki' => $hki['included'] ? [
                        'status' => $record?->status ?? 'pending',
                        'status_label' => HkiRecord::STATUSES[$record?->status ?? 'pending'],
                        'registration_number' => $record?->registration_number,
                        'certificate_id' => $record?->hasCertificate() ? $record->id : null,
                    ] : null,
                    'author_certificate' => $certificate ? [
                        'id' => $certificate->id,
                        'number' => $certificate->number,
                    ] : null,
                    'author_certificate_note' => $certificate ? null : $this->certificateNote($book, $hasAuthorTemplate),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Buku terbit berhasil diambil.',
            'data' => $books,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Ebook lengkap - hanya penulis buku (dan admin lewat panel admin)
    |--------------------------------------------------------------------------
    */

    public function ebook(Request $request, Book $book): Response
    {
        abort_unless(
            Book::publishedByAuthor($request->user()->id)->whereKey($book->id)->exists(),
            404,
            'Buku tidak ditemukan.'
        );

        return self::ebookResponse($book);
    }

    public static function ebookResponse(Book $book): Response
    {
        abort_unless($book->hasEbook() && Storage::disk('local')->exists($book->ebook_file), 404, 'Ebook buku ini belum diunggah admin.');

        $extension = strtolower(pathinfo($book->ebook_file, PATHINFO_EXTENSION));
        $name = (Str::slug($book->title) ?: 'ebook').'.'.$extension;

        return Storage::disk('local')->download($book->ebook_file, $name, [
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function certificateNote(Book $book, bool $hasTemplate): string
    {
        if (! $hasTemplate) {
            return 'Templat sertifikat penulis belum disiapkan admin.';
        }

        if (blank($book->isbn) || $book->citation_publication_date === null) {
            return 'Sertifikat tersedia setelah buku memiliki ISBN dan tanggal terbit.';
        }

        return 'Sertifikat belum tersedia.';
    }
}
