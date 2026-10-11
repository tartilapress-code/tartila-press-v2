<?php

namespace App\Http\Controllers\Api\V1\Certificate;

use App\Http\Controllers\Api\V1\Admin\HkiController;
use App\Http\Controllers\Controller;
use App\Models\HkiRecord;
use App\Services\HkiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** "Sertifikat Saya" bagian HKI: sertifikat HKI karya yang ditulis user. */
class MyHkiController extends Controller
{
    public function __construct(private readonly HkiService $hki) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Sertifikat HKI berhasil diambil.',
            'data' => $this->hki->certificatesFor($request->user()),
        ]);
    }

    public function download(Request $request, HkiRecord $hkiRecord): Response
    {
        $user = $request->user();

        abort_unless(
            $this->hki->authorsOf($hkiRecord)->contains('id', $user->id) || $user->roles()->where('name', 'admin')->exists(),
            404,
            'Sertifikat tidak ditemukan.'
        );

        return HkiController::certificateResponse($hkiRecord, $request->boolean('inline'));
    }
}
