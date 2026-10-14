import { useEffect, useState } from 'react';
import * as editorApi from '@/data/editor/editorApi';

type Score = { matching: number; total: number; score: number | null };

type Insight = {
    completed: number;
    in_progress: number;
    total: number;
    level: number;
    level_floors: Record<string, number>;
    under_monitoring: boolean;
    performance: {
        on_time: Score;
        review: Score;
        author_revision: Score;
        overall: number | null;
    };
};

function ScoreBox({
    label,
    hint,
    value,
}: {
    label: string;
    hint: string;
    value: Score;
}) {
    return (
        <div className="rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
            <p className="text-xs text-oxford-navy-900/65">{label}</p>
            <p className="text-lg font-bold text-oxford-navy-700">
                {value.score === null ? '—' : value.score.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-oxford-navy-900/60">
                    / 10
                </span>
            </p>
            <p className="text-xs text-oxford-navy-900/60">
                {value.matching}/{value.total} {hint}
            </p>
        </div>
    );
}

/**
 * Level dan performa editor itu sendiri. Hanya terlihat oleh editor yang bersangkutan dan
 * admin; penulis dan pengguna lain tidak pernah melihatnya.
 */
export default function EditorInsightCard() {
    const [insight, setInsight] = useState<Insight | null>(null);

    useEffect(() => {
        editorApi
            .myInsight()
            .then((response) => setInsight(response.data))
            .catch(() => setInsight(null));
    }, []);

    if (!insight) {
        return null;
    }

    const next = Object.entries(insight.level_floors)
        .map(([level, floor]) => ({ level: Number(level), floor }))
        .find((item) => item.level === insight.level + 1);

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
            {insight.under_monitoring && (
                <p
                    role="note"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                >
                    Akun Anda sedang dalam pemantauan admin: Anda belum bisa
                    mengambil naskah dari pool, dan penulis diberi saran untuk
                    memilih editor lain.
                </p>
            )}

            <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                    <p className="text-xs text-oxford-navy-900/65">Level</p>
                    <p className="text-2xl font-bold text-oxford-navy-700">
                        {insight.level}
                        <span className="ml-1 text-sm font-normal text-oxford-navy-900/60">
                            / 5
                        </span>
                    </p>
                </div>
                <div>
                    <p className="text-xs text-oxford-navy-900/65">Performa</p>
                    <p className="text-2xl font-bold text-forest-moss-700">
                        {insight.performance.overall === null
                            ? '—'
                            : insight.performance.overall.toFixed(1)}
                        <span className="ml-1 text-sm font-normal text-oxford-navy-900/60">
                            / 10
                        </span>
                    </p>
                </div>
                <p className="text-sm text-oxford-navy-900/75">
                    {insight.completed} naskah selesai, {insight.in_progress}{' '}
                    sedang dikerjakan.
                    {next &&
                        ` Level ${next.level} tercapai di ${next.floor} naskah (kini ${insight.total}).`}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ScoreBox
                    label="Ketepatan waktu"
                    hint="naskah tepat deadline"
                    value={insight.performance.on_time}
                />
                <ScoreBox
                    label="Tanpa reject admin"
                    hint="hasil edit disetujui"
                    value={insight.performance.review}
                />
                <ScoreBox
                    label="Tanpa revisi penulis"
                    hint="hasil edit tanpa revisi"
                    value={insight.performance.author_revision}
                />
            </div>
            <p className="text-xs text-oxford-navy-900/60">
                Level dan performa hanya terlihat oleh Anda dan admin.
            </p>
        </div>
    );
}
