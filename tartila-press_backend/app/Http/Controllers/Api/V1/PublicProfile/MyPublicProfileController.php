<?php

namespace App\Http\Controllers\Api\V1\PublicProfile;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\PublicProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MyPublicProfileController extends Controller
{
    /**
     * Get authenticated user's public profile.
     */
    public function show(Request $request)
    {
        $user = $request->user();

        $profile = $user->publicProfile()
            ->with('experiences')
            ->first();

        return response()->json([
            'success' => true,
            'message' => 'Public profile berhasil diambil.',
            'data' => $profile,
            'books' => Book::publishedByAuthor($user->id)
                ->with(['category', 'fieldCategory'])
                ->latest()
                ->get(),
            'edited_books' => Book::publishedByEditor($user->id)
                ->with(['category', 'fieldCategory'])
                ->latest()
                ->get(),
        ]);
    }

    /**
     * Create or update authenticated user's public profile.
     */
    public function upsert(Request $request)
    {
        $user = $request->user();

        $this->ensureEligible($user);

        $validated = $request->validate([
            'pen_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'bio' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'city' => [
                'nullable',
                'string',
                'max:255',
            ],

            'profile_photo' => [
                'nullable',
                'string',
                'max:500',
            ],

            'is_published' => [
                'sometimes',
                'boolean',
            ],
        ]);

        $profile = DB::transaction(function () use ($user, $validated) {

            $profile = $user->publicProfile()->first();

            $slug = $profile?->slug;

            if (! $slug) {
                $baseSlug = Str::slug(
                    $validated['pen_name']
                        ?? $user->name
                );

                $slug = $this->generateUniqueSlug($baseSlug);
            }

            $profile = $user->publicProfile()->updateOrCreate(
                [
                    'user_id' => $user->id,
                ],
                [
                    'slug' => $slug,
                    'pen_name' => $validated['pen_name'] ?? null,
                    'bio' => $validated['bio'] ?? null,
                    'city' => $validated['city'] ?? null,
                    'profile_photo' => $validated['profile_photo'] ?? null,
                    'is_published' => $validated['is_published']
                        ?? $profile?->is_published
                        ?? false,
                ]
            );

            return $profile->load('experiences');
        });

        return response()->json([
            'success' => true,
            'message' => 'Public profile berhasil disimpan.',
            'data' => $profile,
        ]);
    }

    /**
     * Ensure only penulis/editor can manage public profile.
     */
    private function ensureEligible($user): void
    {
        $allowed = $user->roles()
            ->whereIn('name', [
                'penulis',
                'editor',
            ])
            ->exists();

        abort_unless(
            $allowed,
            403,
            'Hanya penulis atau editor yang dapat mengelola public profile.'
        );
    }

    /**
     * Generate unique public slug.
     */
    private function generateUniqueSlug(string $baseSlug): string
    {
        $slug = $baseSlug ?: 'profile';

        $originalSlug = $slug;
        $counter = 1;

        while (
            PublicProfile::where(
                'slug',
                $slug
            )->exists()
        ) {
            $slug = $originalSlug.'-'.$counter;
            $counter++;
        }

        return $slug;
    }
}
