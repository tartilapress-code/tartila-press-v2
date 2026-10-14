<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Services\EditorInsightService;
use App\Support\Languages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyEditorProfileController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Show - Profil editor milik sendiri
    |--------------------------------------------------------------------------
    */

    public function show(Request $request): JsonResponse
    {
        $this->ensureEligible($request->user());

        return response()->json([
            'success' => true,
            'message' => 'Profil editor berhasil diambil.',
            'data' => $request->user()->editorProfile,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Insight - Level & performa milik sendiri
    |--------------------------------------------------------------------------
    */

    public function insight(Request $request, EditorInsightService $insight): JsonResponse
    {
        $user = $request->user();

        $this->ensureEligible($user);

        return response()->json([
            'success' => true,
            'message' => 'Level dan performa berhasil diambil.',
            'data' => [
                ...$insight->metrics([$user->id])[$user->id],
                'level_floors' => EditorInsightService::LEVEL_FLOORS,
                'under_monitoring' => (bool) $user->editorProfile?->is_banned,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Upsert - Buat/ubah profil editor milik sendiri
    |--------------------------------------------------------------------------
    */

    public function upsert(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->ensureEligible($user);

        $validated = $request->validate([
            'fee' => [
                'nullable',
                'numeric',
                'min:0',
                'max:'.self::MAX_MONEY_AMOUNT,
            ],

            'bio' => [
                'nullable',
                'string',
                'max:5000',
            ],

            // Bahasa yang dikuasai (boleh lebih dari satu).
            ...Languages::rules(),

            'is_available' => [
                'nullable',
                'boolean',
            ],

            // Layanan co-author: centang, fee mandiri, dan keterangan (seperti profil editor).
            'is_coauthor' => ['nullable', 'boolean'],
            'coauthor_fee' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'coauthor_bio' => ['nullable', 'string', 'max:5000'],
        ]);

        // Fee kosong = 0 (kolomnya tidak boleh kosong).
        if (array_key_exists('coauthor_fee', $validated)) {
            $validated['coauthor_fee'] ??= 0;
        }

        $profile = $user->editorProfile()->updateOrCreate(
            [
                'user_id' => $user->id,
            ],
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Profil editor berhasil disimpan.',
            'data' => $profile,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Ensure only editor can manage editor profile.
    |--------------------------------------------------------------------------
    */

    private function ensureEligible($user): void
    {
        $allowed = $user->roles()
            ->where('name', 'editor')
            ->exists();

        abort_unless(
            $allowed,
            403,
            'Hanya Editor yang dapat mengelola profil ini.'
        );
    }
}
