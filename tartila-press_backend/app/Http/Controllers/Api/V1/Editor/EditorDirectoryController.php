<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Services\EditorInsightService;
use Illuminate\Http\JsonResponse;

class EditorDirectoryController extends Controller
{
    public function __construct(private readonly EditorInsightService $insight) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Daftar editor yang bisa dipilih penulis
    |--------------------------------------------------------------------------
    |
    | Editor yang dipromosikan (maksimal 3, level dan performa tertinggi) tampil paling atas.
    | Editor dalam pemantauan tetap bisa dipilih tetapi diberi penanda "dalam pemantauan".
    | Level dan performa TIDAK dikirim ke penulis; hanya dipakai untuk mengurutkan.
    |
    */

    public function index(): JsonResponse
    {
        $promoted = $this->insight->promotedTop();

        $editors = EditorProfile::with('user')
            ->where('is_available', true)
            ->get()
            ->map(function (EditorProfile $profile) use ($promoted) {
                return [
                    'user_id' => $profile->user_id,
                    'name' => $profile->user->name,
                    'fee' => $profile->fee,
                    'bio' => $profile->bio,
                    'languages' => $profile->languages,
                    'is_promoted' => in_array($profile->user_id, $promoted, true),
                    'under_monitoring' => (bool) $profile->is_banned,
                ];
            })
            ->sortBy(function (array $editor) use ($promoted) {
                $position = array_search($editor['user_id'], $promoted, true);

                return $position === false ? PHP_INT_MAX : $position;
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar editor berhasil diambil.',
            'data' => $editors,
        ]);
    }
}
