<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Services\ManuscriptAssignmentService;
use Illuminate\Http\JsonResponse;

class CoauthorDirectoryController extends Controller
{
    public function __construct(private readonly ManuscriptAssignmentService $assignment) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Daftar co-author yang bisa dipilih penulis
    |--------------------------------------------------------------------------
    |
    | Hanya editor yang mencentang "co-author" (dan tersedia).
    |
    */

    public function index(): JsonResponse
    {
        $coauthors = EditorProfile::with('user')
            ->where('is_coauthor', true)
            ->where('is_available', true)
            ->get()
            ->map(fn (EditorProfile $profile) => [
                'user_id' => $profile->user_id,
                'name' => $profile->user->name,
                'fee' => $profile->coauthor_fee,
                'bio' => $profile->coauthor_bio,
                'languages' => $profile->languages,
                'under_monitoring' => (bool) $profile->is_banned,
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Daftar co-author berhasil diambil.',
            'data' => $coauthors,
            'meta' => ['royalty_percent' => $this->assignment->royaltyPercent()],
        ]);
    }
}
