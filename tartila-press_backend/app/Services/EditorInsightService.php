<?php

namespace App\Services;

use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use Illuminate\Support\Collection;

/**
 * Statistik editor untuk Kelola Editor (admin): jumlah naskah, level, dan performa.
 *
 * Level (dari banyak naskah yang dikerjakan): 1 = 0-5, 2 = 6-10, 3 = 11-25, 4 = 26-50, 5 = 51+.
 *
 * Performa = tiga nilai 1-10, masing-masing dari rasio "sesuai / total" (nilai = 1 + 9 x rasio):
 *  - ketepatan waktu: hasil edit pertama dikirim sebelum/pada deadline (naskah ber-deadline);
 *  - tanpa reject: hasil edit yang disetujui admin dari semua hasil edit yang sudah direview;
 *  - tanpa revisi penulis: hasil edit disetujui admin yang tidak diminta revisi lagi oleh penulis.
 * Nilai keseluruhan = rata-rata nilai yang sudah punya data. Hanya untuk admin dan editornya sendiri.
 */
class EditorInsightService
{
    /** Batas bawah naskah per level (urut naik). */
    public const LEVEL_FLOORS = [1 => 0, 2 => 6, 3 => 11, 4 => 26, 5 => 51];

    /** Jumlah editor dipromosikan yang tampil teratas. */
    public const PROMOTED_LIMIT = 3;

    private const WORKING_STATUSES_EXCLUDED = ['completed'];

    public static function levelFor(int $manuscripts): int
    {
        $level = 1;

        foreach (self::LEVEL_FLOORS as $candidate => $floor) {
            if ($manuscripts >= $floor) {
                $level = $candidate;
            }
        }

        return $level;
    }

    /** Nilai 1-10 dari rasio sesuai/total; null bila belum ada data. */
    public static function score(int $matching, int $total): ?float
    {
        return $total === 0 ? null : round(1 + 9 * ($matching / $total), 1);
    }

    /**
     * Statistik banyak editor sekaligus (query dikelompokkan, tanpa N+1).
     *
     * @param  iterable<int>  $editorIds
     * @return array<int, array<string, mixed>> per id editor
     */
    public function metrics(iterable $editorIds): array
    {
        $editorIds = collect($editorIds)->map(fn ($id) => (int) $id)->unique()->values();

        $manuscripts = Manuscript::whereIn('editor_id', $editorIds)
            ->get(['id', 'editor_id', 'status', 'editor_deadline']);

        $revisions = ManuscriptRevision::whereIn('manuscript_id', $manuscripts->pluck('id'))
            ->where('role', 'editor')
            ->orderBy('revision_number')
            ->get(['id', 'manuscript_id', 'revision_number', 'admin_status', 'created_at'])
            ->groupBy('manuscript_id');

        $result = [];

        foreach ($editorIds as $editorId) {
            $mine = $manuscripts->where('editor_id', $editorId);
            $onTime = ['matching' => 0, 'total' => 0];
            $review = ['matching' => 0, 'total' => 0];
            $author = ['matching' => 0, 'total' => 0];

            foreach ($mine as $manuscript) {
                /** @var Collection<int, ManuscriptRevision> $list */
                $list = $revisions->get($manuscript->id, collect())->values();

                // Ketepatan waktu: hasil edit pertama vs deadline (belum dikirim tapi lewat deadline = terlambat).
                if ($manuscript->editor_deadline) {
                    $deadline = $manuscript->editor_deadline->copy()->endOfDay();
                    $first = $list->first();

                    if ($first) {
                        $onTime['total']++;
                        $onTime['matching'] += $first->created_at->lte($deadline) ? 1 : 0;
                    } elseif ($deadline->isPast()) {
                        $onTime['total']++;
                    }
                }

                foreach ($list as $index => $revision) {
                    if ($revision->admin_status !== 'pending') {
                        $review['total']++;
                        $review['matching'] += $revision->admin_status === 'approved' ? 1 : 0;
                    }

                    if ($revision->admin_status !== 'approved') {
                        continue;
                    }

                    $isLast = $index === $list->count() - 1;

                    // Hasil edit terakhir yang sedang menunggu keputusan penulis belum dihitung.
                    if ($isLast && $manuscript->status === 'pending_penulis_review') {
                        continue;
                    }

                    // Diminta revisi penulis = setelahnya ada hasil edit baru, atau naskah kembali
                    // ke editor (in_editing) padahal hasil edit terakhir sudah disetujui admin.
                    $revised = ! $isLast || $manuscript->status === 'in_editing';

                    $author['total']++;
                    $author['matching'] += $revised ? 0 : 1;
                }
            }

            $scores = [
                'on_time' => $onTime + ['score' => self::score($onTime['matching'], $onTime['total'])],
                'review' => $review + ['score' => self::score($review['matching'], $review['total'])],
                'author_revision' => $author + ['score' => self::score($author['matching'], $author['total'])],
            ];
            $known = collect($scores)->pluck('score')->filter(fn ($score) => $score !== null);

            $total = $mine->count();
            $completed = $mine->where('status', 'completed')->count();

            $result[$editorId] = [
                'completed' => $completed,
                'in_progress' => $mine->whereNotIn('status', self::WORKING_STATUSES_EXCLUDED)->count(),
                'total' => $total,
                'level' => self::levelFor($total),
                'performance' => [
                    ...$scores,
                    'overall' => $known->isEmpty() ? null : round($known->avg(), 1),
                ],
            ];
        }

        return $result;
    }

    /**
     * Editor dipromosikan yang tampil teratas: maksimal 3, urut level lalu performa tertinggi.
     * Editor yang sedang dalam pemantauan tidak ikut dipromosikan.
     *
     * @return list<int> id user editor
     */
    public function promotedTop(): array
    {
        $ids = EditorProfile::where('is_promoted', true)->where('is_banned', false)->pluck('user_id');

        if ($ids->isEmpty()) {
            return [];
        }

        $metrics = $this->metrics($ids);

        return $ids
            ->sort(function (int $a, int $b) use ($metrics) {
                return [$metrics[$b]['level'], $metrics[$b]['performance']['overall'] ?? 0, $a]
                    <=> [$metrics[$a]['level'], $metrics[$a]['performance']['overall'] ?? 0, $b];
            })
            ->take(self::PROMOTED_LIMIT)
            ->values()
            ->all();
    }
}
