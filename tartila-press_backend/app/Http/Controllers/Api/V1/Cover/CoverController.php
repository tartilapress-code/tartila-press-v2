<?php

namespace App\Http\Controllers\Api\V1\Cover;

use App\Http\Controllers\Controller;
use App\Models\Cover;
use App\Models\CoverProject;
use App\Models\Manuscript;
use App\Services\Cover\CoverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/** Sisi penulis (dan admin) untuk cover: lihat pilihan, memilih / voting, unduh. */
class CoverController extends Controller
{
    public function __construct(private readonly CoverService $covers) {}

    /** Status cover naskah ini (null bila belum ada tagihan cover). */
    public function show(Request $request, Manuscript $manuscript): JsonResponse
    {
        $project = CoverProject::where('manuscript_id', $manuscript->id)->first();

        if (! $project) {
            return response()->json(['success' => true, 'message' => 'Belum ada cover.', 'data' => null]);
        }

        $this->authorize($request, $project);
        $this->covers->tick($project);

        return response()->json([
            'success' => true,
            'message' => 'Cover berhasil diambil.',
            'data' => $this->covers->state($project->fresh(), $request->user(), $this->isAdmin($request)),
        ]);
    }

    public function vote(Request $request, Manuscript $manuscript): JsonResponse
    {
        $project = CoverProject::where('manuscript_id', $manuscript->id)->firstOrFail();

        $validated = $request->validate([
            // null = "buat ulang" (tidak ada yang cocok).
            'cover_id' => ['nullable', 'integer'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->covers->vote($project, $request->user(), $validated['cover_id'] ?? null, $validated['note'] ?? null);

        return response()->json([
            'success' => true,
            'message' => 'Pilihan Anda tersimpan.',
            'data' => $this->covers->state($project->fresh(), $request->user()),
        ]);
    }

    public function image(Request $request, Cover $cover): Response
    {
        return $this->file($request, $cover, false);
    }

    public function download(Request $request, Cover $cover): Response
    {
        return $this->file($request, $cover, true);
    }

    private function file(Request $request, Cover $cover, bool $attachment): Response
    {
        $project = $cover->project;
        $this->authorize($request, $project);

        abort_unless($cover->file_path && Storage::disk('local')->exists($cover->file_path), 404, 'Berkas cover sudah dihapus dari sistem (tersisa riwayat).');

        $name = "cover-{$project->id}-{$cover->position}.".pathinfo($cover->file_path, PATHINFO_EXTENSION);

        return $attachment
            ? Storage::disk('local')->download($cover->file_path, $name, ['Cache-Control' => 'private, no-store'])
            : Storage::disk('local')->response($cover->file_path, $name, ['Cache-Control' => 'private, no-store']);
    }

    /** Hanya admin dan penulis naskah/buku ini. */
    private function authorize(Request $request, CoverProject $project): void
    {
        abort_unless(
            $this->isAdmin($request) || $this->covers->authors($project)->contains('id', $request->user()->id),
            403,
            'Anda tidak berwenang melihat cover ini.'
        );
    }

    private function isAdmin(Request $request): bool
    {
        return $request->user()->roles()->where('name', 'admin')->exists();
    }
}
