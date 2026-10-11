<?php

namespace App\Http\Controllers\Api\V1\Manuscript;

use App\Http\Controllers\Controller;
use App\Models\BookChapter;
use App\Models\ChapterRevisionRequest;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Services\BookChapterCompilationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Naskah awal per bab dari naskah gabungan Book Chapter: editor (dan admin)
 * melihat/mengunduh naskah tiap bab dan memberi catatan revisi per bab yang
 * dikirim ke penulis bab tersebut.
 */
class CompilationChapterController extends Controller
{
    public function __construct(private readonly BookChapterCompilationService $service) {}

    public function index(Request $request, Manuscript $manuscript): JsonResponse
    {
        $this->ensureCanManage($request, $manuscript);

        $chapters = BookChapter::where('book_id', $manuscript->compiled_book_id)
            ->with([
                'manuscript.user:id,name',
                'manuscript.revisions',
                'manuscript.chapterRevisionRequests.requester:id,name',
            ])
            ->orderBy('chapter_number')
            ->get()
            ->map(fn (BookChapter $chapter) => [
                'id' => $chapter->id,
                'chapter_number' => $chapter->chapter_number,
                'title' => $chapter->title,
                'manuscript' => $chapter->manuscript ? [
                    'id' => $chapter->manuscript->id,
                    'status' => $chapter->manuscript->status,
                    'author' => $chapter->manuscript->user?->name,
                    // Naskah awal penulis (semua versi) untuk dirujuk editor.
                    'revisions' => $chapter->manuscript->revisions
                        ->where('role', 'penulis')
                        ->sortByDesc('revision_number')
                        ->map(fn (ManuscriptRevision $revision) => [
                            'id' => $revision->id,
                            'revision_number' => $revision->revision_number,
                            'original_filename' => $revision->original_filename,
                            'admin_status' => $revision->admin_status,
                            'created_at' => $revision->created_at,
                        ])->values(),
                    'revision_requests' => $chapter->manuscript->chapterRevisionRequests
                        ->map(fn (ChapterRevisionRequest $item) => [
                            'id' => $item->id,
                            'note' => $item->note,
                            'requested_by' => $item->requester?->name,
                            'created_at' => $item->created_at,
                            'resolved_at' => $item->resolved_at,
                        ])->values(),
                ] : null,
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah per bab berhasil diambil.',
            'data' => $chapters,
        ]);
    }

    public function requestRevision(Request $request, Manuscript $manuscript, Manuscript $chapter): JsonResponse
    {
        $this->ensureCanManage($request, $manuscript);

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:5000'],
        ]);

        $revisionRequest = $this->service->requestChapterRevision($manuscript, $chapter, $request->user(), $validated['note']);

        return response()->json([
            'success' => true,
            'message' => 'Catatan revisi dikirim ke penulis bab ini.',
            'data' => $revisionRequest,
        ], 201);
    }

    /** Hanya editor naskah gabungan dan admin. */
    private function ensureCanManage(Request $request, Manuscript $manuscript): void
    {
        abort_unless($manuscript->isCompilation(), 404, 'Naskah ini bukan naskah gabungan Book Chapter.');

        $user = $request->user();

        abort_unless(
            $manuscript->editor_id === $user->id || $user->roles()->where('name', 'admin')->exists(),
            403,
            'Hanya editor naskah gabungan dan admin yang dapat mengakses ini.'
        );
    }
}
