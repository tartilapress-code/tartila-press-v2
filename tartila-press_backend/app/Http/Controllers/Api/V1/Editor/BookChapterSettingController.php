<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\BookChapterSetting;
use App\Models\CustomPackageItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookChapterSettingController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Package Items - Fasilitas & layanan yang bisa dicentang pada proyek,
    | lengkap dengan biaya khusus Book Chapter (kosong = gratis)
    |--------------------------------------------------------------------------
    */

    public function packageItems(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->roles()->where('name', 'editor')->exists(),
            403,
            'Hanya Editor yang dapat mengakses ini.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Daftar fasilitas dan layanan berhasil diambil.',
            'data' => CustomPackageItem::where('is_active', true)
                ->orderBy('type')
                ->orderBy('name')
                ->get(['id', 'type', 'name', 'description', 'book_chapter_cost']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Hint batas minimum/maksimum saat editor membuat proyek sendiri
    |--------------------------------------------------------------------------
    */

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pengaturan Book Chapter berhasil diambil.',
            'data' => BookChapterSetting::current(),
        ]);
    }
}
