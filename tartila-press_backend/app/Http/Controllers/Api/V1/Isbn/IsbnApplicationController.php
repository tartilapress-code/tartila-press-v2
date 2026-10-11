<?php

namespace App\Http\Controllers\Api\V1\Isbn;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\IsbnApplication;
use App\Models\Manuscript;
use App\Services\IsbnApplicationService;
use App\Services\MouService;
use App\Support\SignatureImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IsbnApplicationController extends Controller
{
    public function __construct(
        private readonly IsbnApplicationService $service,
        private readonly MouService $mous,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Store - "Terbitkan ISBN": buat (atau buka lagi) surat permohonan untuk
    | satu naskah (penulis pertama) atau proyek Book Chapter (editor)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'manuscript_id' => ['required_without:book_id', 'nullable', 'integer'],
            'book_id' => ['required_without:manuscript_id', 'nullable', 'integer'],
        ]);

        $user = $request->user();

        $application = isset($validated['manuscript_id'])
            ? $this->service->forManuscript(Manuscript::findOrFail($validated['manuscript_id']), $user)
            : $this->service->forBook(Book::findOrFail($validated['book_id']), $user);

        $this->service->refresh($application);

        return response()->json([
            'success' => true,
            'message' => 'Surat permohonan ISBN siap ditinjau.',
            'data' => $this->withMou($application->fresh(), $request),
        ]);
    }

    public function show(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        $this->authorizeOwner($request, $isbnApplication);
        $this->service->refresh($isbnApplication);

        return response()->json([
            'success' => true,
            'message' => 'Surat permohonan ISBN berhasil diambil.',
            'data' => $this->withMou($isbnApplication->fresh(), $request),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Sign - Penulis/editor menandatangani surat keaslian karya
    |--------------------------------------------------------------------------
    */

    public function sign(Request $request, IsbnApplication $isbnApplication): JsonResponse
    {
        $this->authorizeOwner($request, $isbnApplication);

        abort_if($isbnApplication->is_signed, 422, 'Surat ini sudah ditandatangani.');

        // Paket biasa: penulis pertama menandatangani MOU distribusi buku
        // sekalian dengan surat ini (tanda tangan yang sama).
        $mou = $isbnApplication->type === IsbnApplication::TYPE_REGULAR && $isbnApplication->manuscript
            ? $this->mous->forManuscript($isbnApplication->manuscript)
            : null;
        $signsMou = $mou !== null && $this->mous->blockedReason($mou, $request->user(), 'isbn') === null;

        $validated = $request->validate([
            'signature' => ['required', 'string', 'max:700000'],
            'mou_agreed' => [$signsMou ? 'accepted' : 'nullable'],
            'distribution_choice' => ['nullable', 'array'],
            'distribution_choice.*' => ['string'],
        ], [
            'mou_agreed.accepted' => 'Centang pernyataan bahwa Anda sudah membaca dan menyepakati isi MOU distribusi buku.',
        ]);

        $png = SignatureImage::decode($validated['signature']);

        // Data pribadi dikunci pada saat tanda tangan.
        $this->service->refresh($isbnApplication);

        DB::transaction(function () use ($isbnApplication, $png, $signsMou, $mou, $request, $validated) {
            if ($signsMou) {
                $this->mous->sign($mou, $request->user(), $png, 'isbn', $validated['distribution_choice'] ?? null);
            }

            $path = 'isbn/signatures/'.$isbnApplication->id.'-'.Str::random(8).'.png';
            Storage::disk('local')->put($path, $png);

            $isbnApplication->update([
                'signature_path' => $path,
                'signed_at' => now(),
                'status' => IsbnApplication::STATUS_SIGNED,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => $signsMou
                ? 'Surat dan MOU ditandatangani. Admin akan memberi tanda tangan dan stempel penerbit.'
                : 'Surat ditandatangani. Admin akan memberi tanda tangan dan stempel penerbit.',
            'data' => $this->withMou($isbnApplication->fresh(), $request),
        ]);
    }

    /** Paket biasa: sertakan MOU yang ditandatangani bersama surat ini. */
    private function withMou(IsbnApplication $application, Request $request): IsbnApplication
    {
        $mou = $application->type === IsbnApplication::TYPE_REGULAR && $application->manuscript
            ? $this->mous->forManuscript($application->manuscript)
            : null;

        // Naskah hanya dipakai untuk mencari MOU, tidak ikut dikirim.
        return $application->unsetRelation('manuscript')
            ->setAttribute('mou', $mou ? $this->mous->present($mou, $request->user()) : null);
    }

    /*
    |--------------------------------------------------------------------------
    | Download - PDF TANPA tanda tangan dan stempel penanggung jawab
    |--------------------------------------------------------------------------
    */

    public function download(Request $request, IsbnApplication $isbnApplication): Response
    {
        $this->authorizeOwner($request, $isbnApplication);
        $this->service->refresh($isbnApplication);

        return $this->pdfResponse(
            $this->service->pdf($isbnApplication->fresh(), sealed: false),
            $isbnApplication,
            $request->boolean('inline')
        );
    }

    private function authorizeOwner(Request $request, IsbnApplication $application): void
    {
        abort_unless($application->applicant_id === $request->user()->id, 403, 'Anda tidak berwenang atas surat ini.');
    }

    public static function pdfResponseFor(string $pdf, IsbnApplication $application, bool $inline): Response
    {
        $name = 'Surat-ISBN-'.Str::slug($application->title ?: 'naskah').'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.$name.'"',
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function pdfResponse(string $pdf, IsbnApplication $application, bool $inline): Response
    {
        return self::pdfResponseFor($pdf, $application, $inline);
    }
}
