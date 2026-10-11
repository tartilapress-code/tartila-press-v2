import {
    DIFFICULTY_LABELS,
    DIFFICULTY_TONES,
    isDifficulty,
} from '@/lib/manuscriptDifficulty';

/** Lencana tingkat kesulitan naskah (tidak tampil bila belum diisi admin). */
export default function DifficultyBadge({
    difficulty,
}: {
    difficulty: string | null | undefined;
}) {
    if (!isDifficulty(difficulty)) {
        return null;
    }

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${DIFFICULTY_TONES[difficulty]}`}
        >
            Kesulitan: {DIFFICULTY_LABELS[difficulty]}
        </span>
    );
}
