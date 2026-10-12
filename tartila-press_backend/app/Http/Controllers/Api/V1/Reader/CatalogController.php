<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderComment;
use App\Models\Reader\ReaderPlan;
use App\Models\Reader\ReaderTerm;
use App\Services\Reader\ReaderAccessService;
use App\Services\Reader\ReaderPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Katalog Tartila Book (publik): pilihan filter, daftar & detail buku, komentar, paket langganan. */
class CatalogController extends Controller
{
    public function __construct(private readonly ReaderPresenter $presenter) {}

    public function filters(): JsonResponse
    {
        $terms = ReaderTerm::orderBy('name')->get()->groupBy('type');
        $languages = ReaderBook::listed()->distinct()->pluck('language')->sort()->values();

        return response()->json([
            'success' => true,
            'message' => 'Pilihan filter berhasil diambil.',
            'data' => [
                'pustaka' => collect(ReaderBook::PUSTAKA)->map(fn ($label, $key) => ['value' => $key, 'label' => $label])->values(),
                'education_fields' => ($terms['education_field'] ?? collect())->map(fn ($t) => ['id' => $t->id, 'name' => $t->name])->values(),
                'categories' => ($terms['category'] ?? collect())->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'pustaka' => $t->pustaka])->values(),
                'genres' => ($terms['genre'] ?? collect())->map(fn ($t) => ['id' => $t->id, 'name' => $t->name])->values(),
                'age_limits' => collect(ReaderBook::AGE_LIMITS)->map(fn ($label, $key) => ['value' => $key, 'label' => $label])->values(),
                'languages' => $languages->map(fn ($code) => ['value' => $code, 'label' => ReaderPresenter::LANGUAGE_LABELS[$code] ?? $code])->values(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'pustaka' => ['nullable', Rule::in(array_keys(ReaderBook::PUSTAKA))],
            'age_limit' => ['nullable', Rule::in(array_keys(ReaderBook::AGE_LIMITS))],
            'sort' => ['nullable', Rule::in(['newest', 'popular', 'liked'])],
            'access' => ['nullable', Rule::in(['free', 'paid'])],
        ]);

        $user = $request->user('sanctum');

        $query = ReaderBook::listed()
            ->with(ReaderPresenter::RELATIONS)
            ->when($request->filled('pustaka'), fn ($q) => $q->where('pustaka', $request->query('pustaka')))
            ->when($request->filled('education_field_id'), fn ($q) => $q->where('education_field_id', (int) $request->query('education_field_id')))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', (int) $request->query('category_id')))
            ->when($request->filled('genre_id'), fn ($q) => $q->where('genre_id', (int) $request->query('genre_id')))
            ->when($request->filled('age_limit'), fn ($q) => $q->where('age_limit', $request->query('age_limit')))
            ->when($request->filled('language'), fn ($q) => $q->where('language', $request->query('language')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.mb_strtolower(trim((string) $request->query('q'))).'%';

                $q->whereHas('book', fn ($book) => $book->where(
                    fn ($inner) => $inner->whereRaw('LOWER(title) LIKE ?', [$term])->orWhereRaw('LOWER(authors_text) LIKE ?', [$term])
                ));
            })
            ->when($request->boolean('saved') && $user, fn ($q) => $q->whereHas('savedBy', fn ($s) => $s->where('users.id', $user->id)));

        match ($request->query('sort')) {
            'popular' => $query->orderByDesc('top_page_readers')->orderByDesc('read_events'),
            'liked' => $query->orderByDesc('likes_count'),
            default => $query->orderByDesc(Book::select('ebook_uploaded_at')->whereColumn('books.id', 'reader_books.book_id')),
        };

        $query->orderByDesc('id');

        if ($request->query('access') === 'free') {
            // Gratis = jadwal dibuka yang berlaku; disaring di memori (jumlah buku kecil).
            $all = $query->get();
            $free = app(ReaderAccessService::class)->freeNowMap($all);
            $page = $this->paginateCollection($all->filter(fn ($b) => $free[$b->id])->values(), $request, 12);
            $items = collect($page->items());

            return $this->pageResponse($page->setCollection($this->presenter->many($items, $user)), 'Daftar buku berhasil diambil.');
        }

        if ($request->query('access') === 'paid') {
            $query->whereNotNull('price')->where('price', '>', 0);
        }

        $page = $query->paginate($this->perPage($request, 12, 48));
        $page->setCollection($this->presenter->many($page->getCollection(), $user));

        return $this->pageResponse($page, 'Daftar buku berhasil diambil.');
    }

    public function show(Request $request, ReaderBook $readerBook): JsonResponse
    {
        abort_unless(ReaderBook::listed()->whereKey($readerBook->id)->exists(), 404, 'Buku tidak ditemukan.');

        return response()->json([
            'success' => true,
            'message' => 'Detail buku berhasil diambil.',
            'data' => $this->presenter->one($readerBook, $request->user('sanctum')),
        ]);
    }

    public function plans(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Paket langganan berhasil diambil.',
            'data' => ReaderPlan::where('is_active', true)->orderBy('price')->get()->map(fn (ReaderPlan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'period' => $plan->period,
                'period_label' => ReaderPlan::PERIODS[$plan->period] ?? $plan->period,
                'price' => $plan->price,
                'description' => $plan->description,
            ])->values(),
        ]);
    }

    public function comments(Request $request, ReaderBook $readerBook): JsonResponse
    {
        abort_unless(ReaderBook::listed()->whereKey($readerBook->id)->exists(), 404, 'Buku tidak ditemukan.');

        $page = ReaderComment::with('user')
            ->where('reader_book_id', $readerBook->id)
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        return $this->pageResponse($page, 'Komentar berhasil diambil.', fn (ReaderComment $comment) => [
            'id' => $comment->id,
            'body' => $comment->body,
            'user' => ['id' => $comment->user?->id, 'name' => $comment->user?->name ?? 'Pengguna'],
            'created_at' => $comment->created_at?->toIso8601String(),
        ]);
    }
}
