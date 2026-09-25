<?php

namespace App\Http\Controllers\Api\V1\PublicProfile;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\PublicProfile;
use Illuminate\Http\Request;

class PublicProfileController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar publik Penulis/Editor
    |--------------------------------------------------------------------------
    */

    public function index(Request $request)
    {
        $role = $request->query('role');

        $profiles = PublicProfile::with('user.roles')
            ->where('is_published', true)
            ->when($role, function ($query) use ($role) {
                $query->whereHas('user.roles', function ($query) use ($role) {
                    $query->where('name', $role);
                });
            })
            ->get()
            ->map(function (PublicProfile $profile) {
                return [
                    'slug' => $profile->slug,
                    'name' => $profile->pen_name ?: $profile->user->name,
                    'bio' => $profile->bio,
                    'profile_photo' => $profile->profile_photo,
                    'roles' => $profile->user->roles
                        ->pluck('display_name')
                        ->values(),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar profil publik berhasil diambil.',
            'data' => $profiles,
        ]);
    }

    public function show(string $slug)
    {
        $profile = PublicProfile::with([
            'user.roles',
            'user.editorProfile',
            'experiences',
        ])
            ->where('slug', $slug)
            ->firstOrFail();

        abort_unless(
            $profile->is_published,
            404,
            'Public profile tidak ditemukan.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Public profile berhasil diambil.',
            'data' => [
                'profile' => [
                    'slug' => $profile->slug,
                    'name' => $profile->pen_name
                        ?: $profile->user->name,
                    'bio' => $profile->bio,
                    'city' => $profile->city,
                    'profile_photo' => $profile->profile_photo,

                    'roles' => $profile->user->roles
                        ->pluck('display_name')
                        ->values(),

                    // Bahasa yang dikuasai — hanya untuk akun ber-role editor.
                    'editor_languages' => $profile->user->roles->contains('name', 'editor')
                        ? ($profile->user->editorProfile?->languages ?? [])
                        : [],

                    'experiences' => $profile->experiences
                        ->map(function ($experience) {
                            return [
                                'id' => $experience->id,
                                'title' => $experience->title,
                                'description' => $experience->description,
                                'year' => $experience->year,
                            ];
                        })
                        ->values(),

                    'books' => Book::publishedByAuthor($profile->user_id)
                        ->with(['category', 'fieldCategory'])
                        ->latest()
                        ->get(),
                    'edited_books' => Book::publishedByEditor($profile->user_id)
                        ->with(['category', 'fieldCategory'])
                        ->latest()
                        ->get(),
                ],
            ],
        ]);
    }
}
