<?php

namespace App\Http\Controllers\Api\V1\Mou;

use App\Http\Controllers\Controller;
use App\Models\Mou;
use App\Models\MouAddendum;
use App\Services\MouService;
use App\Support\SignatureImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/** MOU distribusi buku milik penulis (Royalti Saya & halaman tanda tangan). */
class MyMouController extends Controller
{
    public function __construct(private readonly MouService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->service->ensureForUser($user);

        $mous = Mou::with(['signatories.user', 'addenda'])
            ->whereHas('signatories', fn ($query) => $query->where('user_id', $user->id))
            ->latest()
            ->orderByDesc('id')
            ->get()
            ->map(function (Mou $mou) use ($user) {
                $data = $this->service->present($this->service->sync($mou), $user);

                return [
                    ...collect($data)->only(['id', 'type', 'type_label', 'number', 'title', 'status', 'status_label', 'has_final', 'final_uploaded_at', 'me', 'addenda', 'isbn_application_id', 'manuscript_id'])->all(),
                    'mine' => collect($data['signatories'])->firstWhere('is_me', true),
                    'royalty_types' => $data['content']['royalty_types'] ?? null,
                ];
            });

        return response()->json(['success' => true, 'message' => 'MOU Anda berhasil diambil.', 'data' => $mous->values()]);
    }

    public function show(Request $request, Mou $mou): JsonResponse
    {
        $this->authorizeSignatory($request, $mou);

        return response()->json([
            'success' => true,
            'message' => 'MOU berhasil diambil.',
            'data' => $this->service->present($this->service->sync($mou), $request->user()),
        ]);
    }

    /** Penulis selain penulis pertama (paket biasa): tanda tangan di halaman MOU. */
    public function sign(Request $request, Mou $mou): JsonResponse
    {
        $this->authorizeSignatory($request, $mou);

        $request->validate([
            'agreed' => ['accepted'],
            'signature' => ['required', 'string', 'max:700000'],
        ], [
            'agreed.accepted' => 'Centang pernyataan bahwa Anda sudah membaca dan menyepakati isi MOU.',
        ]);

        $mou = $this->service->sign($mou, $request->user(), SignatureImage::decode($request->input('signature')), 'direct');

        return response()->json([
            'success' => true,
            'message' => 'MOU ditandatangani.',
            'data' => $this->service->present($mou, $request->user()),
        ]);
    }

    /** PDF MOU: versi bermeterai bila sudah diunggah admin, selain itu versi tanpa tanda tangan penerbit. */
    public function pdf(Request $request, Mou $mou): Response
    {
        $this->authorizeSignatory($request, $mou);

        if ($mou->final_pdf_path && Storage::disk('local')->exists($mou->final_pdf_path)) {
            return self::fileResponse($mou->final_pdf_path, 'MOU '.$mou->title.' (bermeterai).pdf', $request->boolean('inline'));
        }

        return self::pdfResponse($this->service->pdf($this->service->sync($mou), sealed: false), 'MOU '.$mou->title.'.pdf', $request->boolean('inline'));
    }

    public function addendum(Request $request, Mou $mou, MouAddendum $addendum): Response
    {
        $this->authorizeSignatory($request, $mou);
        abort_unless($addendum->mou_id === $mou->id, 404);

        return self::fileResponse($addendum->file_path, $addendum->file_name, $request->boolean('inline'));
    }

    private function authorizeSignatory(Request $request, Mou $mou): void
    {
        abort_unless(
            $mou->signatories()->where('user_id', $request->user()->id)->exists(),
            403,
            'Anda bukan penulis dalam MOU ini.'
        );
    }

    public static function pdfResponse(string $pdf, string $name, bool $inline): Response
    {
        $name = Str::slug(pathinfo($name, PATHINFO_FILENAME)).'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.$name.'"',
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public static function fileResponse(string $path, string $name, bool $inline): Response
    {
        abort_unless(Storage::disk('local')->exists($path), 404, 'Berkas tidak ditemukan.');

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $safe = Str::slug(pathinfo($name, PATHINFO_FILENAME) ?: 'mou').'.'.$extension;
        $response = Storage::disk('local')->response($path, $safe, [
            'Access-Control-Expose-Headers' => 'Content-Disposition',
            'Cache-Control' => 'private, no-store',
        ]);

        $response->headers->set('Content-Disposition', ($inline ? 'inline' : 'attachment').'; filename="'.$safe.'"');

        return $response;
    }
}
