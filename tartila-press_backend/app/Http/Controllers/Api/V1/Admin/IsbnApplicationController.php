<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Isbn\IsbnApplicationController as UserIsbnApplicationController;
use App\Http\Controllers\Controller;
use App\Models\IsbnApplication;
use App\Models\PublicationProcess;
use App\Services\IsbnApplicationService;
use App\Services\PublicationProcessService;
use App\Support\BookCoverImage;
use App\Support\ManuscriptTemplates\DocxPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class IsbnApplicationController extends Controller
{
    public function __construct(
        private readonly IsbnApplicationService $service,
        private readonly PublicationProcessService $publication,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index - "Terbitkan naskah": surat yang sudah ditandatangani penulis/editor
    | (siap diberi tanda tangan + stempel), beserta yang sudah diproses
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');

        $applications = IsbnApplication::with(['applicant:id,name,email', 'manuscript.book', 'book'])
            ->whereIn('status', [IsbnApplication::STATUS_SIGNED, IsbnApplication::STATUS_PROCESSED])
            ->when(in_array($status, [IsbnApplication::STATUS_SIGNED, IsbnApplication::STATUS_PROCESSED], true), fn ($q) => $q->where('status', $status))
            ->latest('signed_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($request, 20));

        $applications->getCollection()
            // Semua relasi yang dipakai formulir & lampiran dimuat sekali untuk satu halaman.
            ->loadMissing([
                'manuscript.editor', 'manuscript.user', 'manuscript.authorLinks.user', 'manuscript.revisions',
                'book.ownerEditor', 'book.chapters.manuscript.authorLinks.user', 'book.chapters.manuscript.user',
                'book.chapters.manuscript.revisions', 'book.compilation.revisions',
            ])
            ->each(function (IsbnApplication $application) {
                $book = $this->service->publishedBook($application);

                // Link buku terisi saat buku sudah terbit; naskah belum terbit
                // harus diterbitkan dulu lewat halaman detail naskah.
                $application->setAttribute('book_published', $book !== null);
                $application->setAttribute('book_url', $this->service->bookUrl($book));
                $application->setAttribute('form', $this->service->form($application));
                $application->setAttribute('attachments', $this->service->attachments($application));
                $application->makeHidden(['manuscript', 'book']);
            });

        return $this->pageResponse($applications, 'Daftar naskah siap diterbitkan berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Update form - Isian admin untuk formulir pengajuan ISBN
    |--------------------------------------------------------------------------
    */

    public function updateForm(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        $rules = [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'authors' => ['sometimes', 'array', 'min:1', 'max:50'],
            'authors.*' => ['required', 'string', 'max:255'],
            'editor' => ['sometimes', 'nullable', 'string', 'max:255'],
            'designer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'estimated_publish' => ['sometimes', 'nullable', 'string', 'max:50'],
            'province' => ['sometimes', 'nullable', 'string', 'max:100'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'distributor' => ['sometimes', 'nullable', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'pages' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5000'],
            'height_cm' => ['sometimes', 'nullable', 'numeric', 'min:1', 'max:100'],
            'edition' => ['sometimes', 'nullable', 'string', 'max:100'],
            'series' => ['sometimes', 'nullable', 'string', 'max:150'],
            'publication_url' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        foreach (IsbnApplicationService::FORM_OPTIONS as $key => $options) {
            $rules[$key] = ['sometimes', 'nullable', Rule::in(array_keys($options))];
        }

        $validated = $request->validate($rules);

        $isbnApplication->update([
            'form_data' => array_merge($isbnApplication->form_data ?? [], $validated),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data pengisian ISBN disimpan.',
            'data' => $this->service->form($isbnApplication->fresh()),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Download - PDF dengan tanda tangan + stempel penanggung jawab. Unduhan
    | pertama menandai surat sebagai sudah diproses.
    |--------------------------------------------------------------------------
    */

    public function download(Request $request, IsbnApplication $isbnApplication): Response
    {
        abort_unless($isbnApplication->is_signed, 422, 'Surat belum ditandatangani penulis/editor.');

        // Link/akses ketersediaan buku = halaman buku yang bersangkutan, jadi
        // buku harus sudah diterbitkan; linknya diisi saat admin melanjutkan
        // ke tanda tangan.
        $book = $this->service->publishedBook($isbnApplication);

        abort_unless($book, 422, 'Terbitkan bukunya dulu sebelum surat diberi tanda tangan dan stempel.');

        $isbnApplication->update(['availability_link' => $this->service->bookUrl($book)]);

        $pdf = $this->service->pdf($isbnApplication, sealed: true);

        // Pratinjau (inline) tidak menandai surat sebagai diproses.
        if ($isbnApplication->status === IsbnApplication::STATUS_SIGNED && ! $request->boolean('inline')) {
            $isbnApplication->update([
                'status' => IsbnApplication::STATUS_PROCESSED,
                'processed_by' => $request->user()->id,
                'processed_at' => now(),
            ]);
        }

        return UserIsbnApplicationController::pdfResponseFor($pdf, $isbnApplication, $request->boolean('inline'));
    }

    /*
    |--------------------------------------------------------------------------
    | Proses penerbitan - resi ISBN, ISBN ditolak/terbit, buku fisik
    |--------------------------------------------------------------------------
    */

    public function process(IsbnApplication $isbnApplication): JsonResponse
    {
        [$type, $id] = $this->subject($isbnApplication);

        return response()->json([
            'success' => true,
            'message' => 'Proses penerbitan berhasil diambil.',
            'data' => $this->publication->progress($type, $id),
        ]);
    }

    public function updateIsbnProcess(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        abort_unless($isbnApplication->is_signed, 422, 'Surat belum ditandatangani penulis/editor.');

        $validated = $request->validate([
            'action' => ['required', Rule::in(['submit', 'reject', 'publish'])],
            'receipt' => ['required_if:action,submit', 'nullable', 'string', 'max:100'],
            'isbn' => ['required_if:action,publish', 'nullable', 'string', 'max:40', 'regex:/^[0-9Xx\- ]{10,40}$/'],
            'note' => ['required_if:action,reject', 'nullable', 'string', 'max:2000'],
        ], [
            'receipt.required_if' => 'Isi nomor resi pengajuan ISBN.',
            'isbn.required_if' => 'Isi nomor ISBN yang terbit.',
            'isbn.regex' => 'Nomor ISBN hanya boleh angka, X dan tanda hubung.',
            'note.required_if' => 'Tulis catatan alasan penolakan untuk penulis.',
        ]);

        $process = $this->publication->processFor(...$this->subject($isbnApplication));
        $note = filled($validated['note'] ?? null) ? trim($validated['note']) : null;

        match ($validated['action']) {
            'submit' => $this->publication->submitIsbn($process, trim($validated['receipt']), $note, $request->user()),
            'reject' => $this->publication->rejectIsbn($process, (string) $note, $request->user()),
            'publish' => $this->publication->publishIsbn($process, trim($validated['isbn']), $note, $request->user()),
        };

        return $this->process($isbnApplication);
    }

    public function updatePhysicalProcess(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        $validated = $request->validate([
            'step' => ['present', 'nullable', Rule::in(PublicationProcess::PHYSICAL_STEPS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $process = $this->publication->processFor(...$this->subject($isbnApplication));
        $note = filled($validated['note'] ?? null) ? trim($validated['note']) : null;
        $this->publication->setPhysical($process, $validated['step'], $note, $request->user());

        return $this->process($isbnApplication);
    }

    /** Buku fisik termasuk paket atau tidak (null = ikuti paket). */
    public function updateProcessSettings(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        $validated = $request->validate(['includes_physical' => ['present', 'nullable', 'boolean']]);

        $this->publication->processFor(...$this->subject($isbnApplication))
            ->update(['includes_physical' => $validated['includes_physical'], 'updated_by' => $request->user()->id]);

        return $this->process($isbnApplication);
    }

    /** @return array{0: string, 1: int} */
    private function subject(IsbnApplication $application): array
    {
        $subject = $this->publication->subjectForApplication($application);

        abort_unless($subject !== null, 422, 'Naskah/buku untuk surat ini tidak ditemukan.');

        return $subject;
    }

    /*
    |--------------------------------------------------------------------------
    | Dummy - Berkas dummy buku utuh (ebook / naskah gabungan / naskah terakhir)
    | untuk lampiran pengajuan ISBN
    |--------------------------------------------------------------------------
    */

    public function dummy(IsbnApplication $isbnApplication): BinaryFileResponse|StreamedResponse
    {
        $file = $this->service->dummySource($isbnApplication);

        abort_unless($file && Storage::disk('local')->exists($file['path']), 404, 'Berkas dummy buku belum ada.');

        // Word: salinan tanpa template jarak jauh, tautan file:// dan makro.
        if (strtolower(pathinfo($file['filename'], PATHINFO_EXTENSION)) === 'docx') {
            try {
                $safe = DocxPackage::sanitizedCopy(Storage::disk('local')->path($file['path']));
            } catch (RuntimeException) {
                abort(422, 'Berkas Word dummy ini rusak atau berisi bagian yang tidak aman.');
            }

            return response()->download($safe, $file['filename'])->deleteFileAfterSend();
        }

        return Storage::disk('local')->download($file['path'], $file['filename']);
    }

    /*
    |--------------------------------------------------------------------------
    | Cover - Foto cover buku untuk lampiran (lewat domain API supaya bisa
    | diolah di browser)
    |--------------------------------------------------------------------------
    */

    public function cover(IsbnApplication $isbnApplication): Response
    {
        $book = $isbnApplication->type === IsbnApplication::TYPE_CHAPTER
            ? $isbnApplication->book
            : $isbnApplication->manuscript?->book;

        abort_unless($book, 404, 'Buku untuk naskah ini belum dibuat.');

        $image = BookCoverImage::load($book);

        return response($image['bytes'], 200, [
            'Content-Type' => $image['mime'],
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
