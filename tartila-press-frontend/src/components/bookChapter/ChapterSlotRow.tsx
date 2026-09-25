import { useTranslation } from 'react-i18next';
import { useFormat } from '@/i18n/useFormat';
import type { ChapterSlot, SlotStatus } from '@/lib/bookChapterPublic';

const statusStyles: Record<SlotStatus, string> = {
    open: 'bg-forest-moss-100 text-forest-moss-800',
    reserved: 'bg-amber-100 text-amber-800',
    submitted: 'bg-oxford-navy-50 text-oxford-navy-700',
    completed: 'bg-slate-100 text-slate-600',
};

/**
 * Satu baris slot bab: nomor, judul, harga (dengan diskon bila ada), status,
 * dan tombol "Beli Slot Ini" untuk slot yang masih terbuka.
 */
export default function ChapterSlotRow({
    chapter,
    canBuy,
    showSop,
    onBuy,
}: {
    chapter: ChapterSlot;
    // Slot terbuka dan pendaftaran belum ditutup.
    canBuy: boolean;
    // SOP hanya dikirim server untuk pengunjung yang sudah login.
    showSop: boolean;
    onBuy: () => void;
}) {
    const { t } = useTranslation();
    const { rupiah } = useFormat();
    const hasDiscount = chapter.effective_discount > 0;

    return (
        <li className="flex flex-col gap-3 rounded-xl border border-forest-moss-100 bg-white p-4 transition-colors hover:border-forest-moss-300 sm:flex-row sm:items-center sm:gap-4">
            <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-moss-100 font-display text-lg font-bold text-forest-moss-800"
            >
                {chapter.chapter_number}
            </span>

            <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-snug text-oxford-navy-700">
                    <span className="sr-only">
                        {t('bookChapter.slot.srChapter', {
                            number: chapter.chapter_number,
                        })}{' '}
                    </span>
                    {chapter.title}
                </h3>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    <span className="inline-flex flex-wrap items-baseline gap-x-2">
                        {hasDiscount && (
                            <span className="text-xs text-oxford-navy-900/45 line-through">
                                {rupiah(Number(chapter.effective_price))}
                            </span>
                        )}
                        <span className="font-semibold text-oxford-navy-700">
                            {rupiah(chapter.final_price)}
                        </span>
                        {hasDiscount && (
                            <span className="text-xs font-semibold text-forest-moss-700">
                                {t('common.discount', {
                                    percent: chapter.effective_discount,
                                })}
                            </span>
                        )}
                    </span>

                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[chapter.slot_status]}`}
                    >
                        {t(`bookChapter.slotStatus.${chapter.slot_status}`)}
                    </span>
                </div>

                {showSop && chapter.sop_terms && (
                    <p className="mt-2 text-xs leading-relaxed text-oxford-navy-900/55">
                        {t('bookChapter.slot.sop', { text: chapter.sop_terms })}
                    </p>
                )}
            </div>

            {canBuy && (
                <button
                    type="button"
                    onClick={onBuy}
                    aria-label={t('bookChapter.slot.buyAria', {
                        number: chapter.chapter_number,
                    })}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-oxford-navy-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:cursor-pointer hover:bg-oxford-navy-600"
                >
                    {t('bookChapter.slot.buy')}
                </button>
            )}
        </li>
    );
}
