import { useTranslation } from 'react-i18next';
import { RiStarFill } from '@remixicon/react';

/**
 * Lencana "Rekomendasi" untuk konten yang di-pin admin. Diletakkan di pojok kartu; induknya harus
 * `relative`. `className` mengatur posisi (bawaan: kiri atas).
 */
export default function RecommendedBadge({
    className = 'left-3 top-3',
}: {
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <span
            className={`absolute z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-semibold leading-none text-amber-950 shadow-sm sm:text-xs ${className}`}
        >
            <RiStarFill aria-hidden className="size-3" />
            {t('common.recommended')}
        </span>
    );
}
