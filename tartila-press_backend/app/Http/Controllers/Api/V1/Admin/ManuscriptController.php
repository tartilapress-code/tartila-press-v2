<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ManuscriptController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Semua naskah
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $query = Manuscript::with(['user', 'editor', 'revisions', 'book', 'bookChapter'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah berhasil diambil.',
            'data' => $query->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Review Revision - Approve/Reject revisi terbaru
    |--------------------------------------------------------------------------
    */

    public function reviewRevision(
        Request $request,
        Manuscript $manuscript,
        ManuscriptRevision $revision
    ): JsonResponse {
        abort_unless($revision->manuscript_id === $manuscript->id, 404);

        abort_unless(
            $revision->admin_status === 'pending',
            422,
            'Revisi ini sudah pernah direview.'
        );

        $manuscript->load('order.bookChapterSlot.book');

        /*
        |--------------------------------------------------------------------------
        | Fee dari admin
        |--------------------------------------------------------------------------
        |
        | Kalau penulis memilih editor secara langsung, fee dari admin tetap
        | wajib diisi saat approve naskah. Total fee editor = fee permintaan
        | editor (sudah dibayar penulis di order) + fee dari admin.
        |
        */

        $needsAdminFee = $request->input('decision') === 'approve'
            && $revision->role === 'penulis'
            && $manuscript->order->editor_id !== null;

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:2000'],
            'fee' => [
                Rule::requiredIf($needsAdminFee),
                'nullable',
                'numeric',
                'min:0',
                'max:'.self::MAX_MONEY_AMOUNT,
            ],
        ], [
            'fee.required' => 'Fee dari admin wajib diisi karena penulis memilih editor secara langsung. Total fee editor = fee permintaan editor + fee dari admin.',
        ]);

        $approve = $validated['decision'] === 'approve';

        DB::transaction(function () use ($request, $manuscript, $revision, $validated, $approve) {
            $revision->update([
                'admin_status' => $approve ? 'approved' : 'rejected',
                'admin_note' => $validated['note'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            if ($approve) {
                if ($revision->role === 'penulis') {
                    $this->assignEditorFromOrder($manuscript, $validated['fee'] ?? null);
                } else {
                    $manuscript->update(['status' => 'pending_penulis_review']);
                    $manuscript->authorLinks()->update(['approved_at' => null]);
                }
            } else {
                $manuscript->update([
                    'status' => $revision->role === 'penulis'
                        ? 'revision_requested'
                        : 'editor_revision_requested',
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Review revisi berhasil disimpan.',
            'data' => $manuscript->fresh(['revisions', 'editor', 'order']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Assign Editor - Admin menunjuk editor langsung
    |--------------------------------------------------------------------------
    */

    public function assignEditor(Request $request, Manuscript $manuscript): JsonResponse
    {
        $manuscript->load('order');

        abort_unless(
            $manuscript->status === 'pending_editor_assignment',
            422,
            'Naskah tidak sedang menunggu penugasan editor.'
        );

        abort_if(
            $manuscript->order->editor_id,
            422,
            'Penulis sudah memilih editor sendiri untuk pesanan ini.'
        );

        $validated = $request->validate([
            'editor_id' => ['required', 'integer'],
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $editorProfile = EditorProfile::where('user_id', $validated['editor_id'])->first();

        abort_unless($editorProfile, 422, 'User yang dipilih bukan Editor.');

        $manuscript->update([
            'editor_id' => $validated['editor_id'],
            'editor_source' => Manuscript::EDITOR_SOURCE_ADMIN,
            'editor_fee' => $validated['fee'],
            'editor_requested_fee' => null,
            'editor_deadline' => $validated['deadline'] ?? null,
            'editor_assignment_note' => $validated['note'] ?? null,
            'open_for_claim' => false,
            'status' => 'in_editing',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Editor berhasil ditugaskan.',
            'data' => $manuscript->fresh(['editor']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Open Pool - Admin membuka naskah untuk diambil editor
    |--------------------------------------------------------------------------
    */

    public function openPool(Request $request, Manuscript $manuscript): JsonResponse
    {
        $manuscript->load('order');

        abort_unless(
            $manuscript->status === 'pending_editor_assignment',
            422,
            'Naskah tidak sedang menunggu penugasan editor.'
        );

        abort_if(
            $manuscript->order->editor_id,
            422,
            'Penulis sudah memilih editor sendiri untuk pesanan ini.'
        );

        $validated = $request->validate([
            'fee' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'deadline' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $manuscript->update([
            'editor_fee' => $validated['fee'],
            'editor_deadline' => $validated['deadline'] ?? null,
            'editor_assignment_note' => $validated['note'] ?? null,
            'open_for_claim' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil dibuka untuk diambil editor.',
            'data' => $manuscript->fresh(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Tentukan editor setelah revisi penulis di-approve
    |--------------------------------------------------------------------------
    |
    | - Penulis memilih editor langsung → editor itu; total fee = fee
    |   permintaan editor (dari order) + fee dari admin.
    | - Pemilik proyek Book Chapter → editor itu; fee 0.
    | - Selain itu → menunggu penugasan admin (tunjuk / buka pool).
    |
    */

    private function assignEditorFromOrder(Manuscript $manuscript, mixed $adminFee): void
    {
        $order = $manuscript->order;
        $authorChosen = $order->editor_id !== null;
        $projectOwnerEditorId = $order->bookChapterSlot?->book?->owner_editor_id;
        $editorId = $order->editor_id ?? $projectOwnerEditorId;

        if (! $editorId) {
            $manuscript->update(['status' => 'pending_editor_assignment']);

            return;
        }

        if ($authorChosen) {
            $requestedFee = (float) $order->editor_fee;

            $manuscript->update([
                'status' => 'in_editing',
                'editor_id' => $editorId,
                'editor_source' => Manuscript::EDITOR_SOURCE_AUTHOR,
                'editor_requested_fee' => $requestedFee,
                'editor_fee' => round($requestedFee + (float) $adminFee, 2),
            ]);

            return;
        }

        $manuscript->update([
            'status' => 'in_editing',
            'editor_id' => $editorId,
            'editor_source' => Manuscript::EDITOR_SOURCE_PROJECT_OWNER,
            'editor_requested_fee' => null,
            'editor_fee' => 0,
        ]);
    }
}
