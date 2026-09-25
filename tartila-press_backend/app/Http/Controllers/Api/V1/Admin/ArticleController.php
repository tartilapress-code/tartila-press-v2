<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Article::with(['user', 'fieldCategory'])
            ->withCount('likes')
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar artikel berhasil diambil.',
            'data' => $query->get(),
        ]);
    }

    public function approve(Article $article): JsonResponse
    {
        abort_if($article->status !== 'pending', 422, 'Artikel ini sudah diproses sebelumnya.');

        $article->update([
            'status' => 'approved',
            'published_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artikel disetujui dan sudah tayang.',
            'data' => $article,
        ]);
    }

    public function reject(Article $article): JsonResponse
    {
        abort_if($article->status !== 'pending', 422, 'Artikel ini sudah diproses sebelumnya.');

        $article->update(['status' => 'rejected']);

        return response()->json([
            'success' => true,
            'message' => 'Artikel ditolak.',
            'data' => $article,
        ]);
    }
}
