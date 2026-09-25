<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use Illuminate\Http\JsonResponse;

class EditorDirectoryController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar editor yang bisa dipilih penulis
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $editors = EditorProfile::with('user')
            ->where('is_available', true)
            ->get()
            ->map(function (EditorProfile $profile) {
                return [
                    'user_id' => $profile->user_id,
                    'name' => $profile->user->name,
                    'fee' => $profile->fee,
                    'bio' => $profile->bio,
                    'languages' => $profile->languages,
                ];
            });

        return response()->json([
            'success' => true,
            'message' => 'Daftar editor berhasil diambil.',
            'data' => $editors,
        ]);
    }
}
