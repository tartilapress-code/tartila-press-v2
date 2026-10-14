<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Models\FieldCategory;
use App\Models\User;
use App\Models\WalletWithdrawal;
use App\Services\EditorInsightService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Kelola Editor: daftar editor dengan statistik, performa, level, fee, serta status
 * "dalam pemantauan" (banned) dan "dipromosikan".
 */
class EditorManagementController extends Controller
{
    public function __construct(
        private readonly EditorInsightService $insight,
        private readonly WalletService $wallet,
    ) {}

    public function index(): JsonResponse
    {
        $editors = User::whereHas('roles', fn ($query) => $query->where('name', 'editor'))
            ->with('editorProfile')
            ->orderBy('name')
            ->get();

        $metrics = $this->insight->metrics($editors->pluck('id'));
        $promoted = $this->insight->promotedTop();
        $fieldNames = FieldCategory::pluck('name', 'id');

        // Penarikan yang sudah dibayar / masih diproses (saldo dompet gabungan semua jenis pemasukan).
        $withdrawn = WalletWithdrawal::whereIn('user_id', $editors->pluck('id'))
            ->whereIn('status', ['paid', 'pending'])
            ->select('user_id', DB::raw('SUM(amount) as total'))
            ->groupBy('user_id')
            ->pluck('total', 'user_id');

        $rows = $editors->map(function (User $editor) use ($metrics, $promoted, $fieldNames, $withdrawn) {
            $profile = $editor->editorProfile;
            $stats = $metrics[$editor->id];
            $totalFee = round($this->wallet->serviceFees($editor)->sum('amount'), 2);

            return [
                'id' => $editor->id,
                'name' => $editor->name,
                'email' => $editor->email,
                'is_available' => (bool) ($profile?->is_available ?? true),
                'is_coauthor' => (bool) $profile?->is_coauthor,
                'fields' => collect($profile?->field_category_ids ?? [])
                    ->map(fn ($id) => $fieldNames[$id] ?? null)
                    ->filter()
                    ->values(),
                ...$stats,
                'total_fee' => $totalFee,
                // Fee yang belum ditarik = total fee dikurangi penarikan (perkiraan; penarikan dipakai bersama royalti).
                'unclaimed_fee' => max(0, round($totalFee - (float) ($withdrawn[$editor->id] ?? 0), 2)),
                'is_banned' => (bool) $profile?->is_banned,
                'ban_note' => $profile?->ban_note,
                'banned_at' => $profile?->banned_at?->toIso8601String(),
                'is_promoted' => (bool) $profile?->is_promoted,
                'promoted_active' => in_array($editor->id, $promoted, true),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Daftar editor berhasil diambil.',
            'data' => $rows->values(),
            'meta' => [
                'promoted_limit' => EditorInsightService::PROMOTED_LIMIT,
                'level_floors' => EditorInsightService::LEVEL_FLOORS,
            ],
        ]);
    }

    /** Beri / cabut status "dalam pemantauan". Editor dalam pemantauan tidak bisa mengambil naskah dari pool. */
    public function ban(Request $request, User $user): JsonResponse
    {
        $this->ensureEditor($user);

        $validated = $request->validate([
            'banned' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $profile = EditorProfile::firstOrNew(['user_id' => $user->id]);
        $banned = (bool) $validated['banned'];

        $profile->forceFill([
            'is_banned' => $banned,
            'banned_at' => $banned ? now() : null,
            'ban_note' => $banned ? ($validated['note'] ?? null) : null,
            // Editor dalam pemantauan tidak dipromosikan.
            'is_promoted' => $banned ? false : $profile->is_promoted,
            'promoted_at' => $banned ? null : $profile->promoted_at,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => $banned ? 'Editor ditandai dalam pemantauan.' : 'Status pemantauan editor dicabut.',
            'data' => ['id' => $user->id, 'is_banned' => $banned],
        ]);
    }

    /** Promosikan editor: tampil teratas (maksimal 3 dengan level & performa tertinggi). */
    public function promote(Request $request, User $user): JsonResponse
    {
        $this->ensureEditor($user);

        $validated = $request->validate(['promoted' => ['required', 'boolean']]);
        $promoted = (bool) $validated['promoted'];

        $profile = EditorProfile::firstOrNew(['user_id' => $user->id]);

        abort_if($promoted && $profile->is_banned, 422, 'Editor yang sedang dalam pemantauan tidak bisa dipromosikan.');

        $profile->forceFill([
            'is_promoted' => $promoted,
            'promoted_at' => $promoted ? now() : null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => $promoted ? 'Editor dipromosikan.' : 'Promosi editor dicabut.',
            'data' => ['id' => $user->id, 'is_promoted' => $promoted],
        ]);
    }

    private function ensureEditor(User $user): void
    {
        abort_unless($user->roles()->where('name', 'editor')->exists(), 422, 'User ini bukan Editor.');
    }
}
