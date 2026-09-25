<?php

namespace App\Http\Controllers\Api\V1\Article;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    private const EAGER_LOAD = [
        'user.publicProfile',
        'fieldCategory',
    ];

    /*
    |--------------------------------------------------------------------------
    | Index - Daftar artikel publik (yang sudah disetujui admin)
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $articles = Article::approved()
            ->with(self::EAGER_LOAD)
            ->withCount('likes')
            ->latest('published_at')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar artikel berhasil diambil.',
            'data' => $articles,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail artikel publik
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Article $article): JsonResponse
    {
        abort_unless($article->status === 'approved', 404, 'Artikel tidak ditemukan.');

        $article->load([...self::EAGER_LOAD, 'comments.user']);
        $article->loadCount('likes');

        $userId = $request->user()?->id;
        $likedByMe = $userId
            ? $article->likes()->where('user_id', $userId)->exists()
            : false;

        return response()->json([
            'success' => true,
            'message' => 'Detail artikel berhasil diambil.',
            'data' => [
                ...$article->toArray(),
                'liked_by_me' => $likedByMe,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Artikel milik user login (semua status)
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request): JsonResponse
    {
        $articles = $request->user()
            ->articles()
            ->with(self::EAGER_LOAD)
            ->withCount('likes')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Artikel saya berhasil diambil.',
            'data' => $articles,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Semua user (role apa pun) bisa menulis artikel
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'photo' => ['nullable', 'string', 'max:500'],
            'field_category_id' => ['required', 'integer', 'exists:field_categories,id'],
            'body' => ['required', 'string'],
        ]);

        $article = Article::create([
            ...$validated,
            'user_id' => $request->user()->id,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artikel berhasil dikirim, menunggu persetujuan admin.',
            'data' => $article,
        ], 201);
    }
}
