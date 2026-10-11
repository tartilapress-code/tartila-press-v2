<?php

namespace App\Http\Controllers\Api\V1\Certificate;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class MyCertificateController extends Controller
{
    public function __construct(private readonly CertificateService $certificates) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua sertifikat milik user (event, penulis, editor)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $certificates = $this->certificates->listFor($request->user())
            ->map(function (Certificate $certificate) {
                $description = $this->certificates->describe($certificate);

                return [
                    'id' => $certificate->id,
                    'number' => $certificate->number,
                    'category' => $certificate->category(),
                    'title' => $description['title'],
                    'subtitle' => $description['subtitle'],
                    'issued_at' => $certificate->issued_at,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Sertifikat saya berhasil diambil.',
            'data' => $certificates,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Download - PDF sertifikat (pemilik atau admin; bisa diunduh kapan saja)
    |--------------------------------------------------------------------------
    */

    public function download(Request $request, Certificate $certificate): Response
    {
        $user = $request->user();

        abort_unless(
            $certificate->user_id === $user->id || $user->roles()->where('name', 'admin')->exists(),
            404,
            'Sertifikat tidak ditemukan.'
        );

        abort_unless($this->certificates->isAvailable($certificate), 404, 'Sertifikat ini belum tersedia.');

        $rendered = $this->certificates->render($certificate);

        abort_if($rendered === null, 404, 'Sertifikat ini belum tersedia.');

        $disposition = $request->boolean('inline') ? 'inline' : 'attachment';

        return response($rendered['pdf'], 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => $disposition.'; filename="'.$rendered['filename'].'"',
            'Cache-Control' => 'private, no-store',
            // Frontend membaca nama berkas dari header ini (lintas origin).
            'Access-Control-Expose-Headers' => 'Content-Disposition',
        ]);
    }
}
