<?php

namespace App\Http\Controllers\Api\V1\Upload;

use App\Http\Controllers\Controller;
use App\Support\ResponsiveImages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ImageUploadController extends Controller
{
    private const FOLDERS = ['covers', 'profiles', 'bio-photos', 'packages', 'articles', 'about'];

    /*
    |--------------------------------------------------------------------------
    | Store - Upload gambar generik, kembalikan URL publiknya
    |--------------------------------------------------------------------------
    | Dipakai oleh semua input foto/cover di aplikasi (cover buku, foto
    | profil, foto bio penulis, foto paket, dst) - hasilnya berupa URL yang
    | ditaruh ke field yang sama seperti kalau user menempel URL manual.
    */

    public function store(Request $request, ResponsiveImages $images): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'folder' => ['nullable', Rule::in(self::FOLDERS)],
        ]);

        $folder = $validated['folder'] ?? 'misc';
        $path = $validated['file']->store("uploads/{$folder}/{$request->user()->id}", 'public');

        // Versi kecil (WebP 400/900 px) untuk kartu & daftar; berkas asli tetap.
        $images->generate($path);

        return response()->json([
            'success' => true,
            'message' => 'Gambar berhasil diunggah.',
            'data' => [
                'url' => Storage::disk('public')->url($path),
            ],
        ], 201);
    }
}
