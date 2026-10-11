<?php

namespace App\Http\Controllers\Api\V1\Notification;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Notifikasi milik user yang sedang login: daftar, ringkasan belum dibaca
 * (angka per menu + id objek untuk titik merah per baris), tandai dibaca.
 */
class NotificationController extends Controller
{
    /**
     * Tartila Book memakai tabel yang sama: ?scope=reader hanya menampilkan
     * kategori "reader"; tanpa scope (Tartila Press) kategori itu disembunyikan.
     */
    private function scoped(Builder $query, Request $request): Builder
    {
        return $request->query('scope') === 'reader'
            ? $query->where('category', 'reader')
            : $query->where('category', '<>', 'reader');
    }

    public function index(Request $request): JsonResponse
    {
        $notifications = $this->scoped(UserNotification::where('user_id', $request->user()->id), $request)
            ->when($request->boolean('unread'), fn ($query) => $query->whereNull('read_at'))
            ->latest('id')
            ->paginate(min(50, max(5, (int) $request->query('per_page', 20))));

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi berhasil diambil.',
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $unread = $this->scoped(UserNotification::where('user_id', $request->user()->id), $request)
            ->whereNull('read_at')
            ->get(['category', 'subject_type', 'subject_id']);

        return response()->json([
            'success' => true,
            'message' => 'Ringkasan notifikasi berhasil diambil.',
            'data' => [
                'unread_total' => $unread->count(),
                'by_category' => $unread->countBy('category'),
                // Objek yang punya update belum dibaca, mis. {"manuscript": [12, 15]}.
                'subjects' => $unread->whereNotNull('subject_id')
                    ->groupBy('subject_type')
                    ->map(fn ($items) => $items->pluck('subject_id')->unique()->values()),
            ],
        ]);
    }

    /** Tandai dibaca menurut id, kategori, atau objek (mis. saat naskah dibuka). */
    public function markRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['nullable', 'array', 'max:200'],
            'ids.*' => ['integer'],
            'categories' => ['nullable', 'array', 'max:20'],
            'categories.*' => ['string', 'max:40'],
            'subject_type' => ['nullable', 'string', 'max:40', 'required_with:subject_id'],
            'subject_id' => ['nullable', 'integer', 'required_with:subject_type'],
            'all' => ['nullable', 'boolean'],
        ]);

        $query = $this->scoped(UserNotification::where('user_id', $request->user()->id), $request)->whereNull('read_at');

        if (empty($validated['all'])) {
            $hasFilter = ! empty($validated['ids']) || ! empty($validated['categories']) || isset($validated['subject_id']);
            abort_unless($hasFilter, 422, 'Pilih notifikasi yang akan ditandai dibaca.');

            $query->where(function ($where) use ($validated) {
                if (! empty($validated['ids'])) {
                    $where->orWhereIn('id', $validated['ids']);
                }

                if (! empty($validated['categories'])) {
                    $where->orWhereIn('category', $validated['categories']);
                }

                if (isset($validated['subject_id'])) {
                    $where->orWhere(fn ($subject) => $subject
                        ->where('subject_type', $validated['subject_type'])
                        ->where('subject_id', $validated['subject_id']));
                }
            });
        }

        $updated = $query->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi ditandai sudah dibaca.',
            'data' => ['updated' => $updated],
        ]);
    }
}
