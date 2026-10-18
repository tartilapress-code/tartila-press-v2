<?php

namespace App\Http\Controllers\Api\V1\PublicProfile;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\PublicProfile;
use App\Services\EditorInsightService;
use App\Services\RecommendationService;
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
        // Nama tampil = nama pena, atau nama akun bila kosong.
        $displayName = "LOWER(COALESCE(NULLIF(public_profiles.pen_name, ''), users.name))";

        $query = PublicProfile::with('user.roles')
            ->join('users', 'users.id', '=', 'public_profiles.user_id')
            ->select('public_profiles.*')
            ->where('public_profiles.is_published', true)
            ->when($role, function ($query) use ($role) {
                $query->whereHas('user.roles', function ($query) use ($role) {
                    $query->where('name', $role);
                });
            });

        if ($request->filled('search')) {
            $query->whereRaw("{$displayName} LIKE ?", ['%'.mb_strtolower((string) $request->query('search')).'%']);
        }

        // Daftar editor: editor yang dipromosikan (maksimal 3, level & performa tertinggi) selalu paling atas.
        $promoted = $role === 'editor' ? app(EditorInsightService::class)->promotedTop() : [];

        if ($promoted !== []) {
            $cases = collect($promoted)->values()->map(fn ($id, $index) => 'WHEN '.(int) $id.' THEN '.$index)->implode(' ');
            $query->orderByRaw("CASE public_profiles.user_id {$cases} ELSE ".count($promoted).' END');
        }

        // Daftar penulis: rekomendasi (maksimal 3, dipin admin) paling atas.
        $recommendations = app(RecommendationService::class);

        if ($role === 'penulis') {
            $recommendations->pinFirst($query, 'author', 'public_profiles.user_id');
        }

        match ($request->query('sort')) {
            'az' => $query->orderByRaw("{$displayName} ASC"),
            'za' => $query->orderByRaw("{$displayName} DESC"),
            default => $query->orderBy('public_profiles.id'),
        };

        return $this->pageResponse(
            $query->paginate($this->perPage($request, 12)),
            'Daftar profil publik berhasil diambil.',
            fn (PublicProfile $profile) => [
                'slug' => $profile->slug,
                'name' => $profile->pen_name ?: $profile->user->name,
                'bio' => $profile->bio,
                'profile_photo' => $profile->profile_photo,
                'roles' => $profile->user->roles
                    ->pluck('display_name')
                    ->values(),
                'is_promoted' => in_array($profile->user_id, $promoted, true),
                // Satu tanda untuk lencana "Rekomendasi": editor = dipromosikan, penulis = dipin admin.
                'is_recommended' => $role === 'penulis'
                    ? in_array((int) $profile->user_id, $recommendations->pinnedIds('author'), true)
                    : in_array($profile->user_id, $promoted, true),
            ],
        );
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
