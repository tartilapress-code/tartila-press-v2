<?php

namespace App\Services;

use App\Models\Manuscript;
use App\Models\MouTemplate;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Penugasan editor dan co-author sebuah naskah paket.
 *
 * Alur dengan layanan co-author (opsional):
 *   penulis kirim naskah -> admin koreksi & setujui -> CO-AUTHOR menyusun (dipilih penulis /
 *   ditunjuk admin / diambil dari pool) -> admin koreksi & setujui -> penulis setujui atau minta revisi
 *   -> (setelah penulis setuju) EDITOR mengedit -> admin koreksi & setujui -> penulis tinjauan akhir.
 * Co-author dan editor orang yang berbeda. Co-author berasal dari editor yang mencentang "co-author"
 * dan tercatat sebagai penulis TERAKHIR (royalti tetap, tanda tangan MOU, tampil di buku).
 */
class ManuscriptAssignmentService
{
    public const STATUS_PENDING_COAUTHOR_ASSIGNMENT = 'pending_coauthor_assignment';

    public const STATUS_IN_COAUTHORING = 'in_coauthoring';

    public const STATUS_COAUTHOR_REVISION_REQUESTED = 'coauthor_revision_requested';

    public const STATUS_PENDING_ADMIN_REVIEW_COAUTHOR = 'pending_admin_review_coauthor';

    public const STATUS_PENDING_AUTHOR_REVIEW_COAUTHOR = 'pending_author_review_coauthor';

    /** Status di mana co-author sedang mengerjakan naskah. */
    public const COAUTHOR_WORKING = [self::STATUS_IN_COAUTHORING, self::STATUS_COAUTHOR_REVISION_REQUESTED];

    public function __construct(private readonly ManuscriptPoolService $pool) {}

    // =====================================================================
    // Co-author
    // =====================================================================

    /** Jatah royalti tetap co-author (persen, untuk buku fisik dan ebook), diatur di template MOU. */
    public function royaltyPercent(): float
    {
        return (float) MouTemplate::current('regular')->coauthor_royalty;
    }

    /** Editor yang mencentang co-author (dan masih tersedia). */
    public static function isCoauthor(User $user): bool
    {
        $user->loadMissing('editorProfile');

        return (bool) $user->editorProfile?->is_coauthor
            && $user->roles()->where('name', 'editor')->exists();
    }

    /** Pastikan $userId boleh menjadi co-author naskah ini (centang co-author, bukan penulis/editor naskah). */
    public function assertAssignable(Manuscript $manuscript, int $userId): User
    {
        $user = User::with('editorProfile')->find($userId);

        abort_unless($user && self::isCoauthor($user), 422, 'User yang dipilih belum mencentang co-author di profil editornya.');

        $manuscript->loadMissing('authorLinks', 'order');

        abort_if(
            $manuscript->authorLinks->where('is_coauthor', false)->contains('user_id', $userId) || $manuscript->user_id === $userId,
            422,
            'Penulis naskah tidak bisa menjadi co-author naskahnya sendiri.'
        );

        abort_if(
            $manuscript->editor_id === $userId || $manuscript->order?->editor_id === $userId,
            422,
            'Co-author dan editor harus orang yang berbeda.'
        );

        return $user;
    }

    /**
     * Co-author yang boleh mengambil naskah dari pool: mencentang co-author, bidang keahlian cocok,
     * dan bukan editor/penulis naskah itu.
     *
     * @return Collection<int, User>
     */
    public function eligibleCoauthors(Manuscript $manuscript): Collection
    {
        return User::whereHas('roles', fn ($query) => $query->where('name', 'editor'))
            ->whereHas('editorProfile', fn ($query) => $query->where('is_coauthor', true)->where('is_banned', false))
            ->with('editorProfile')
            ->get()
            ->filter(fn (User $user) => $this->canClaim($user, $manuscript))
            ->values();
    }

    public function canClaim(User $user, Manuscript $manuscript): bool
    {
        if (! self::isCoauthor($user) || $manuscript->user_id === $user->id || $manuscript->editor_id === $user->id) {
            return false;
        }

        return $this->pool->canClaim($user, $manuscript);
    }

    /**
     * Tetapkan co-author: tercatat sebagai penulis terakhir dan naskah masuk fase co-author.
     *
     * @param  float  $fee  total fee co-author (fee pilihan penulis + fee dari admin, atau fee dari admin)
     */
    public function attach(
        Manuscript $manuscript,
        User $coauthor,
        string $source,
        float $fee,
        ?float $requestedFee = null,
        ?string $deadline = null,
        ?string $note = null,
    ): Manuscript {
        DB::transaction(function () use ($manuscript, $coauthor, $source, $fee, $requestedFee, $deadline, $note) {
            $coauthor->loadMissing('publicProfile');

            $manuscript->authorLinks()->updateOrCreate(
                ['user_id' => $coauthor->id],
                [
                    'position' => (int) $manuscript->authorLinks()->reorder()->max('position') + 1,
                    'is_coauthor' => true,
                    // Co-author tidak ikut menyetujui tinjauan penulis.
                    'approved_at' => now(),
                ]
            );

            $display = $coauthor->publicProfile?->pen_name ?: $coauthor->name;
            $names = array_values((array) $manuscript->authors);

            if (! in_array($display, $names, true)) {
                $names[] = $display;
            }

            $manuscript->update([
                'authors' => $names,
                'coauthor_id' => $coauthor->id,
                'coauthor_source' => $source,
                'coauthor_fee' => round($fee, 2),
                'coauthor_requested_fee' => $requestedFee,
                'coauthor_deadline' => $deadline,
                'coauthor_assignment_note' => $note,
                'coauthor_open_for_claim' => false,
                'status' => self::STATUS_IN_COAUTHORING,
            ]);
        });

        return $manuscript->fresh(['coauthor']);
    }

    /**
     * Setelah admin menyetujui naskah penulis: layanan co-author -> fase co-author; kalau tidak -> editor.
     */
    public function afterAuthorApproved(Manuscript $manuscript, mixed $editorAdminFee, mixed $coauthorAdminFee): void
    {
        $manuscript->loadMissing('order');

        if (! $manuscript->wants_coauthor) {
            $this->assignEditorFromOrder($manuscript, $editorAdminFee);

            return;
        }

        // Fee tambahan admin untuk editor pilihan penulis dipakai nanti, saat tahap editor dimulai.
        $manuscript->update(['editor_admin_fee_pending' => $editorAdminFee === null ? null : (float) $editorAdminFee]);

        $order = $manuscript->order;

        if ($order?->coauthor_id) {
            $coauthor = $this->assertAssignable($manuscript, $order->coauthor_id);
            $requested = (float) $order->coauthor_fee;

            $this->attach($manuscript, $coauthor, Manuscript::EDITOR_SOURCE_AUTHOR, round($requested + (float) $coauthorAdminFee, 2), $requested);

            return;
        }

        $manuscript->update(['status' => self::STATUS_PENDING_COAUTHOR_ASSIGNMENT]);
    }

    /** Penulis menyetujui hasil co-author: tahap editor dimulai. */
    public function afterCoauthorApproved(Manuscript $manuscript): void
    {
        $manuscript->authorLinks()->where('is_coauthor', false)->update(['approved_at' => null]);

        $this->assignEditorFromOrder($manuscript, $manuscript->editor_admin_fee_pending);
    }

    // =====================================================================
    // Editor
    // =====================================================================

    /**
     * Tentukan editor setelah naskah siap diedit:
     * - Penulis memilih editor langsung: editor itu; total fee = fee permintaan + fee dari admin.
     * - Pemilik proyek Book Chapter: editor itu; fee 0.
     * - Selain itu: menunggu penugasan admin (tunjuk / buka pool).
     */
    public function assignEditorFromOrder(Manuscript $manuscript, mixed $adminFee): void
    {
        $manuscript->loadMissing('order.bookChapterSlot.book');

        $order = $manuscript->order;
        $authorChosen = $order?->editor_id !== null;
        $projectOwnerEditorId = $order?->bookChapterSlot?->book?->owner_editor_id;
        $editorId = $order?->editor_id ?? $projectOwnerEditorId;

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
