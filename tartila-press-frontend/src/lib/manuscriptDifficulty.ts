// Tingkat kesulitan naskah — sama dengan Manuscript::DIFFICULTIES di backend.
export type ManuscriptDifficulty = 'mudah' | 'sedang' | 'sulit';

export const DIFFICULTY_LABELS: Record<ManuscriptDifficulty, string> = {
    mudah: 'Mudah',
    sedang: 'Sedang',
    sulit: 'Sulit',
};

export const DIFFICULTY_OPTIONS = (
    Object.keys(DIFFICULTY_LABELS) as ManuscriptDifficulty[]
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

// Warna lencana per tingkat.
export const DIFFICULTY_TONES: Record<ManuscriptDifficulty, string> = {
    mudah: 'bg-forest-moss-50 text-forest-moss-800 ring-forest-moss-200',
    sedang: 'bg-amber-50 text-amber-800 ring-amber-200',
    sulit: 'bg-red-50 text-red-700 ring-red-200',
};

export function isDifficulty(value: unknown): value is ManuscriptDifficulty {
    return typeof value === 'string' && value in DIFFICULTY_LABELS;
}
