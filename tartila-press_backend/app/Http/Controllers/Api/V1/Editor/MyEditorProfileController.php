<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
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
        ]);

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
