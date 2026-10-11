<?php

namespace App\Http\Controllers\Api\V1\Manuscript;

use App\Http\Controllers\Controller;
use App\Models\Manuscript;
use App\Models\PublicationProcess;
use App\Services\PublicationProcessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Riwayat status proses penerbitan di Naskah Saya (penulis). */
class PublicationProgressController extends Controller
{
    public function __construct(private readonly PublicationProcessService $service) {}

    public function show(Request $request, Manuscript $manuscript): JsonResponse
    {
        $this->ensureCanView($request, $manuscript);

        $progress = $this->service->progressForManuscript($manuscript);

        if ($progress !== null) {
            $progress['can_confirm_delivery'] = $this->service->canConfirmDelivery($manuscript, $request->user(), $progress);
        }

        return response()->json([
            'success' => true,
            'message' => 'Riwayat proses penerbitan berhasil diambil.',
            'data' => $progress,
        ]);
    }

    /** Penulis menandai buku fisik sudah sampai. */
    public function confirmDelivery(Request $request, Manuscript $manuscript): JsonResponse
    {
        $progress = $this->service->progressForManuscript($manuscript);

        abort_unless(
            $progress !== null && $this->service->canConfirmDelivery($manuscript, $request->user(), $progress),
            422,
            'Buku belum dikirim atau sudah ditandai sampai.'
        );

        [$type, $id] = $this->service->subjectForManuscript($manuscript);
        $process = PublicationProcess::where('subject_type', $type)->where('subject_id', $id)->firstOrFail();
        $this->service->setPhysical($process, 'delivered', 'Dikonfirmasi penulis', $request->user());

        return $this->show($request, $manuscript);
    }

    private function ensureCanView(Request $request, Manuscript $manuscript): void
    {
        $user = $request->user();

        abort_unless(
            $manuscript->authorLinks()->where('user_id', $user->id)->exists()
                || $manuscript->editor_id === $user->id
                || $user->roles()->where('name', 'admin')->exists(),
            403,
            'Anda tidak berwenang mengakses naskah ini.'
        );
    }
}
