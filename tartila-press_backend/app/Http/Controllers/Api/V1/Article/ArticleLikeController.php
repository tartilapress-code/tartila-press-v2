<?php

namespace App\Http\Controllers\Api\V1\Article;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleLikeController extends Controller
{
    public function store(Request $request, Article $article): JsonResponse
    {
        $article->likes()->firstOrCreate([
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artikel disukai.',
            'data' => [
                'likes_count' => $article->likes()->count(),
                'liked_by_me' => true,
            ],
        ], 201);
    }

    public function destroy(Request $request, Article $article): JsonResponse
    {
        $article->likes()
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Suka dibatalkan.',
            'data' => [
                'likes_count' => $article->likes()->count(),
                'liked_by_me' => false,
            ],
        ]);
    }
}
