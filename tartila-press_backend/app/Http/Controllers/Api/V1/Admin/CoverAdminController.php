<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Cover;
use App\Models\CoverProject;
use App\Services\Cover\CoverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/** Admin: fitur cover khusus (cover paket, cover Book Chapter, cover buku terbit). */
class CoverAdminController extends Controller
{
    private const IMAGE_RULES = ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360'];

    public function __construct(private readonly CoverService $covers) {}

    /** Tagihan cover paket: naskah yang hasil editingnya sudah disetujui + Book Chapter yang naskah gabungannya siap. */
    public function packages(Request $request): JsonResponse
    {
        $projects = CoverProject::where('stage', 'urgent')
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower((string) $request->query('search')).'%']))
            ->with(['covers', 'book'])
            ->orderByRaw("CASE status WHEN 'awaiting_upload' THEN 0 WHEN 'revision' THEN 1 WHEN 'voting' THEN 2 ELSE 3 END")
            ->latest('id')
            ->get();

        return $this->list($projects, 'Daftar cover paket berhasil diambil.');
    }

    /** Cover Book Chapter yang belum mendesak (naskah belum digabung / auto layout). */
    public function chapters(Request $request): JsonResponse
    {
        $projects = CoverProject::where('stage', 'early')
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower((string) $request->query('search')).'%']))
            ->with(['covers', 'book'])
            ->latest('id')
            ->get();

        return $this->list($projects, 'Daftar cover Book Chapter berhasil diambil.');
    }

    /** Cover buku terbit: cover final / terakhir yang dipakai di buku. */
    public function books(Request $request): JsonResponse
    {
        $page = Book::where('is_active', true)
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower((string) $request->query('search')).'%']))
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        $ids = $page->getCollection()->pluck('id');
        $manuscripts = $page->getCollection()->pluck('manuscript_id')->filter();
        $projects = CoverProject::where(fn ($q) => $q->whereIn('book_id', $ids)->orWhereIn('manuscript_id', $manuscripts))->get();

        return $this->pageResponse($page, 'Daftar cover buku berhasil diambil.', function (Book $book) use ($projects) {
            $project = $projects->first(fn (CoverProject $p) => $p->book_id === $book->id || ($book->manuscript_id && $p->manuscript_id === $book->manuscript_id));

            return [
                'id' => $book->id,
                'title' => $book->title,
                'authors' => $book->authors_text,
                'front_cover' => $book->front_cover,
                'is_chapter' => (bool) $book->is_chapter_offering,
                'project_id' => $project?->id,
                'published_at' => $project?->published_at?->toIso8601String(),
                'purge_at' => $project?->published_at?->copy()->addDays(CoverService::RETENTION_DAYS)->toIso8601String(),
                'files_purged' => $project?->files_purged_at !== null,
            ];
        });
    }

    public function show(CoverProject $project): JsonResponse
    {
        $this->covers->tick($project);

        return response()->json(['success' => true, 'message' => 'Cover berhasil diambil.', 'data' => $this->covers->state($project->fresh(), null, true)]);
    }

    public function upload(Request $request, CoverProject $project): JsonResponse
    {
        $validated = $request->validate(['file' => self::IMAGE_RULES, 'position' => ['required', 'integer', 'min:1', 'max:'.CoverService::OPTION_COUNT]]);

        $this->covers->uploadOption($project, $validated['file'], (int) $validated['position'], $request->user());

        return response()->json(['success' => true, 'message' => 'Cover diunggah.', 'data' => $this->covers->state($project->fresh(), null, true)]);
    }

    public function revision(Request $request, CoverProject $project): JsonResponse
    {
        $validated = $request->validate(['file' => self::IMAGE_RULES]);

        $this->covers->uploadRevision($project, $validated['file'], $request->user());

        return response()->json(['success' => true, 'message' => 'Revisi cover diunggah; penulis diminta menyetujuinya.', 'data' => $this->covers->state($project->fresh(), null, true)]);
    }

    public function destroyCover(Cover $cover): JsonResponse
    {
        $project = $cover->project;
        $this->covers->deleteOption($cover);

        return response()->json(['success' => true, 'message' => 'Cover dihapus.', 'data' => $this->covers->state($project->fresh(), null, true)]);
    }

    public function decide(Request $request, CoverProject $project): JsonResponse
    {
        $validated = $request->validate(['cover_id' => ['required', 'integer']]);

        $this->covers->decide($project, Cover::findOrFail($validated['cover_id']), $request->user());

        return response()->json(['success' => true, 'message' => 'Cover ditetapkan.', 'data' => $this->covers->state($project->fresh(), null, true)]);
    }

    public function replaceBookCover(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate(['file' => self::IMAGE_RULES]);

        $book = $this->covers->replaceBookCover($book, $validated['file'], $request->user());

        return response()->json(['success' => true, 'message' => 'Cover buku diganti.', 'data' => ['id' => $book->id, 'front_cover' => $book->front_cover]]);
    }

    /** @param Collection<int, CoverProject> $projects */
    private function list($projects, string $message): JsonResponse
    {
        $authors = [];

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $projects->map(function (CoverProject $project) use (&$authors) {
                $current = $project->covers->where('round', $project->round);
                $votes = $project->votes()->where('round', $project->round)->count();
                $authorCount = $this->covers->authors($project)->count();

                return [
                    'id' => $project->id,
                    'source' => $project->source,
                    'stage' => $project->stage,
                    'title' => $project->title,
                    'status' => $project->status,
                    'round' => $project->round,
                    'uploaded' => $current->count(),
                    'needed' => CoverService::OPTION_COUNT,
                    'votes' => $votes,
                    'authors' => $authorCount,
                    'voting_deadline_at' => $project->voting_deadline_at?->toIso8601String(),
                    'manuscript_id' => $project->manuscript_id,
                    'published_at' => $project->published_at?->toIso8601String(),
                    'front_cover' => $project->book?->front_cover,
                    'deadline' => $project->book?->submission_deadline?->toIso8601String(),
                    'created_at' => $project->created_at?->toIso8601String(),
                ];
            })->values(),
        ]);
    }
}
