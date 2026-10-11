<?php

namespace App\Http\Controllers\Api\V1\Upload;

use App\Http\Controllers\Controller;
use App\Support\ResponsiveImages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DocumentUploadController extends Controller
{
    private const FOLDERS = ['event-documents', 'event-banners', 'certificates'];

    /*
    |--------------------------------------------------------------------------
    | Store - Upload dokumen generik (PDF/DOC/gambar), kembalikan URL publiknya
    |--------------------------------------------------------------------------
    | Dipakai untuk dokumen wajib pendaftaran event, spanduk event, dan
    | sertifikat - sama seperti ImageUploadController tapi mengizinkan
    | dokumen non-gambar (PDF/DOC) selain jpg/png.
    */

    public function store(Request $request, ResponsiveImages $images): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
            'folder' => ['nullable', Rule::in(self::FOLDERS)],
        ]);

        $folder = $validated['folder'] ?? 'misc';
        $path = $validated['file']->store("uploads/{$folder}/{$request->user()->id}", 'public');

        // Spanduk event tampil di kartu daftar event: buat versi kecilnya.
        if ($folder === 'event-banners') {
            $images->generate($path);
        }

        return response()->json([
            'success' => true,
            'message' => 'Dokumen berhasil diunggah.',
            'data' => [
                'url' => Storage::disk('public')->url($path),
            ],
        ], 201);
    }
}
