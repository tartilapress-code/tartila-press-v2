<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\RecommendationService;
use App\Support\IsbnTypes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BookChapterProjectController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Proyek Book Chapter yang masih punya slot terbuka
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Pencarian, kategori, dan urutan dikerjakan di server supaya daftar
        // bisa per halaman: ?search=&category=<nama>&sort=newest|deadline|price|slots.
        $query = $this->openProjects()
            ->with(['category', 'fieldCategory', 'ownerEditor', 'chapters', 'packageItems']);

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower((string) $request->query('search')).'%';

            $query->where(fn (Builder $q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])
                ->orWhereHas('ownerEditor', fn (Builder $editor) => $editor->whereRaw('LOWER(name) LIKE ?', [$term])));
        }

        if ($request->filled('category')) {
            $name = (string) $request->query('category');

            $query->where(fn (Builder $q) => $q->whereHas('category', fn (Builder $c) => $c->where('name', $name))
                ->orWhereHas('fieldCategory', fn (Builder $c) => $c->where('name', $name)));
        }

        // Jenis ISBN: print (cetak), electronic (digital), both (keduanya).
        if (in_array($request->query('isbn_type'), IsbnTypes::ALL, true)) {
            $query->where('isbn_type', $request->query('isbn_type'));
        }

        $open = fn ($chapters) => $chapters->whereNull('manuscript_id')->whereNull('order_id');

        match ($request->query('sort')) {
            // Tenggat terdekat dulu; tanpa tenggat paling akhir.
            'deadline' => $query->orderByRaw('CASE WHEN submission_deadline IS NULL THEN 1 ELSE 0 END')
                ->orderBy('submission_deadline'),
            // Harga slot terbuka termurah (setelah diskon).
            'price' => $query->orderBy(
                DB::table('book_chapters')
                    ->selectRaw('MIN(COALESCE(book_chapters.price, books.price) * (100 - COALESCE(book_chapters.discount, books.discount, 0)) / 100)')
                    ->whereColumn('book_chapters.book_id', 'books.id')
                    ->whereNull('book_chapters.manuscript_id')
                    ->whereNull('book_chapters.order_id')
            ),
            // Slot terbuka terbanyak.
            'slots' => $query->withCount(['chapters as open_slots_count' => $open])->orderByDesc('open_slots_count'),
            default => $query->latest(),
        };

        $query->orderByDesc('id');

        // Rekomendasi (maksimal 3, dipin admin) paling atas.
        $recommendations = app(RecommendationService::class);
        $recommendations->pinFirst($query, 'book_chapter', 'books.id');

        $page = $query->paginate($this->perPage($request, 12));
        $projects = $page->getCollection();
        $recommendations->markRecommended($projects, 'book_chapter');

        $this->presentIncludedPackage($projects);

        if (! $request->user('sanctum')) {
            $this->hideGuestRestrictedFields($projects);
        }

        return $this->pageResponse($page, 'Daftar proyek Book Chapter berhasil diambil.', meta: [
            'categories' => $this->categoryOptions(),
        ]);
    }

    /** Proyek yang masih menerima naskah: ada slot terbuka dan tenggat belum lewat. */
    private function openProjects(): Builder
    {
        return Book::query()
            ->where('is_chapter_offering', true)
            ->whereHas('chapters', fn ($query) => $query->whereNull('manuscript_id')->whereNull('order_id'))
            ->where(fn ($query) => $query->whereNull('submission_deadline')
                ->orWhere('submission_deadline', '>=', now()));
    }

    /**
     * Nama kategori buku & bidang keilmuan dari SEMUA proyek terbuka (untuk
     * pilihan filter), bukan hanya halaman yang sedang tampil.
     *
     * @return list<string>
     */
    private function categoryOptions(): array
    {
        return $this->openProjects()
            ->with(['category:id,name', 'fieldCategory:id,name'])
            ->get(['id', 'book_category_id', 'field_category_id'])
            ->flatMap(fn (Book $book) => [$book->category?->name, $book->fieldCategory?->name])
            ->filter()
            ->unique()
            ->sort(fn ($a, $b) => strcasecmp($a, $b))
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail proyek + status tiap slot bab
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Book $bookChapterProject): JsonResponse
    {
        abort_unless($bookChapterProject->is_chapter_offering, 404, 'Proyek Book Chapter tidak ditemukan.');

        $bookChapterProject->load(['category', 'fieldCategory', 'ownerEditor', 'chapters', 'packageItems']);

        $this->presentIncludedPackage(collect([$bookChapterProject]));

        if (! $request->user('sanctum')) {
            $this->hideGuestRestrictedFields(collect([$bookChapterProject]));
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail proyek Book Chapter berhasil diambil.',
            'data' => $bookChapterProject,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Fasilitas & layanan yang didapatkan (nama saja, dari daftar item paket
    | custom yang dicentang admin/editor). Biaya item tidak ikut terkirim.
    |--------------------------------------------------------------------------
    */

    private function presentIncludedPackage(Collection $projects): void
    {
        foreach ($projects as $project) {
            $items = $project->packageItems;

            $project->setAttribute(
                'package_facilities',
                $items->where('type', 'facility')->pluck('name')->values()->all()
            );
            $project->setAttribute(
                'package_services',
                $items->where('type', 'service')->pluck('name')->values()->all()
            );

            $project->unsetRelation('packageItems');
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Sembunyikan deskripsi proyek & SOP tiap bab untuk pengunjung yang
    | belum login — hanya judul bab dan harga yang tetap publik.
    |--------------------------------------------------------------------------
    */

    private function hideGuestRestrictedFields(Collection $projects): void
    {
        foreach ($projects as $project) {
            $project->makeHidden('description');
            $project->chapters->each(fn ($chapter) => $chapter->makeHidden('sop_terms'));
        }
    }
}
