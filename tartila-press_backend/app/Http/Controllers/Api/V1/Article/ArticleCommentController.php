<?php

namespace App\Http\Controllers\Api\V1\Article;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleCommentController extends Controller
{
    public function index(Article $article): JsonResponse
    {
        $comments = $article->comments()->with('user')->get();

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil diambil.',
            'data' => $comments,
        ]);
    }

    public function store(Request $request, Article $article): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment = $article->comments()->create([
            ...$validated,
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil dikirim.',
            'data' => $comment->load('user'),
        ], 201);
    }

    public function destroy(Request $request, Article $article, ArticleComment $comment): JsonResponse
    {
        abort_unless($comment->article_id === $article->id, 404, 'Komentar tidak ditemukan.');
        abort_unless($comment->user_id === $request->user()->id, 403, 'Anda hanya bisa menghapus komentar sendiri.');

        $comment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil dihapus.',
        ]);
    }
}
