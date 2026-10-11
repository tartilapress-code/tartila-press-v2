<?php

namespace App\Http\Controllers\Api\V1\Article;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Database\Eloquent\Builder;
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

    public function index(Request $request): JsonResponse
    {
        // ?search= (judul/penulis) & ?category=<nama bidang>, per halaman.
        // ?highlight=1 tanpa filter: artikel terbaru & paling disukai dikirim
        // terpisah di meta.highlights (disorot di atas) dan tidak diulang di daftar.
        $search = trim((string) $request->query('search', ''));
        $category = (string) $request->query('category', '');
        $filtered = $search !== '' || $category !== '';

        $base = fn () => Article::approved()->with(self::EAGER_LOAD)->withCount('likes');
        $highlights = $filtered || ! $request->boolean('highlight') ? collect() : $this->highlights($base);

        $query = $base()
            ->whereNotIn('id', $highlights->pluck('id'))
            ->latest('published_at')
            ->orderByDesc('id');

        if ($search !== '') {
            $term = '%'.mb_strtolower($search).'%';

            $query->where(fn (Builder $q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])
                ->orWhereHas('user', fn (Builder $user) => $user->whereRaw('LOWER(name) LIKE ?', [$term]))
                ->orWhereHas('user.publicProfile', fn (Builder $profile) => $profile->whereRaw('LOWER(pen_name) LIKE ?', [$term])));
        }

        if ($category !== '') {
            $query->whereHas('fieldCategory', fn (Builder $q) => $q->where('name', $category));
        }

        return $this->pageResponse($query->paginate($this->perPage($request, 12)), 'Daftar artikel berhasil diambil.', meta: [
            'highlights' => $highlights->values(),
            'categories' => Article::approved()->with('fieldCategory:id,name')->get(['id', 'field_category_id'])
                ->pluck('fieldCategory.name')->filter()->unique()->sort()->values(),
        ]);
    }

    /** Artikel terbaru + artikel paling disukai (selain yang terbaru). */
    private function highlights(callable $base)
    {
        $newest = $base()->latest('published_at')->orderByDesc('id')->first();

        if (! $newest) {
            return collect();
        }

        $mostLiked = $base()->whereKeyNot($newest->id)->orderByDesc('likes_count')->latest('published_at')->first();

        return collect([$newest, $mostLiked])->filter();
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
