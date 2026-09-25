<?php

namespace App\Http\Controllers\Api\V1\PublicProfile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileExperienceController extends Controller
{
    public function index(Request $request)
    {
        $profile = $request->user()
            ->publicProfile;

        abort_unless(
            $profile,
            404,
            'Public profile belum dibuat.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Jejak pengalaman berhasil diambil.',
            'data' => $profile->experiences,
        ]);
    }

    public function store(Request $request)
    {
        $profile = $request->user()
            ->publicProfile;

        abort_unless(
            $profile,
            404,
            'Public profile belum dibuat.'
        );

        $validated = $request->validate([
            'title' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'year' => [
                'nullable',
                'integer',
                'min:1900',
                'max:' . now()->year,
            ],

            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ]);

        $experience = $profile->experiences()->create(
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Jejak pengalaman berhasil ditambahkan.',
            'data' => $experience,
        ], 201);
    }

    public function update(
        Request $request,
        int $id
    ) {
        $profile = $request->user()
            ->publicProfile;

        abort_unless(
            $profile,
            404,
            'Public profile belum dibuat.'
        );

        $experience = $profile->experiences()
            ->findOrFail($id);

        $validated = $request->validate([
            'title' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
                'max:5000',
            ],

            'year' => [
                'sometimes',
                'nullable',
                'integer',
                'min:1900',
                'max:' . now()->year,
            ],

            'sort_order' => [
                'sometimes',
                'integer',
                'min:0',
            ],
        ]);

        $experience->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Jejak pengalaman berhasil diperbarui.',
            'data' => $experience,
        ]);
    }

    public function destroy(
        Request $request,
        int $id
    ) {
        $profile = $request->user()
            ->publicProfile;

        abort_unless(
            $profile,
            404,
            'Public profile belum dibuat.'
        );

        $experience = $profile->experiences()
            ->findOrFail($id);

        $experience->delete();

        return response()->json([
            'success' => true,
            'message' => 'Jejak pengalaman berhasil dihapus.',
        ]);
    }
}