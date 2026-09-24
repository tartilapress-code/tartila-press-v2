import { RiStarFill } from '@remixicon/react';

const STARS = [1, 2, 3, 4, 5];

/**
 * Bintang penilaian 0–5 yang menampilkan pecahan (4,5 = empat setengah
 * bintang): lapisan bintang emas dipotong sesuai persentase di atas lapisan
 * bintang abu-abu.
 */
export default function StarRating({
    value,
    starClassName = 'size-4',
}: {
    value: number;
    // Ukuran satu bintang (kelas Tailwind `size-*`).
    starClassName?: string;
}) {
    const percent = Math.min(100, Math.max(0, (value / 5) * 100));

    return (
        <span
            role="img"
            aria-label={`Penilaian ${value.toFixed(1)} dari 5`}
            className="relative inline-flex shrink-0"
        >
            <span className="flex text-oxford-navy-900/15">
                {STARS.map((star) => (
                    <RiStarFill
                        key={star}
                        aria-hidden
                        className={`shrink-0 ${starClassName}`}
                    />
                ))}
            </span>
            <span
                aria-hidden
                className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400"
                style={{ width: `${percent}%` }}
            >
                {STARS.map((star) => (
                    <RiStarFill
                        key={star}
                        className={`shrink-0 ${starClassName}`}
                    />
                ))}
            </span>
        </span>
    );
}
