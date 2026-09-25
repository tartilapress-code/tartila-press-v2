import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/Button/Button';
import { useFormat } from '@/i18n/useFormat';

type ServiceSummaryProps = {
    count: number;
    total: number;
    isAuthenticated: boolean;
    // Catatan tawaran paket yang lebih hemat (hanya di layar lebar).
    hint?: ReactNode;
    onStart: () => void;
    onClear: () => void;
};

/**
 * Ringkasan pilihan di halaman Layanan: jumlah item, estimasi biaya, dan
 * tombol lanjut merakit paket. Di layar lebar berupa kartu di sisi kanan;
 * di layar sempit berupa bar yang menempel di bawah, hanya saat ada pilihan.
 */
export default function ServiceSummary({
    count,
    total,
    isAuthenticated,
    hint,
    onStart,
    onClear,
}: ServiceSummaryProps): ReactNode {
    const { t } = useTranslation();
    const { rupiah } = useFormat();
    const isEmpty = count === 0;

    return (
        <aside
            aria-label={t('services.summary.aria')}
            className={`sticky bottom-3 z-30 flex flex-row items-center justify-between gap-3 rounded-2xl border border-forest-moss-200 bg-white p-3 shadow-[0_10px_30px_-12px_rgba(1,26,44,0.35)] lg:bottom-auto lg:top-24 lg:flex-col lg:items-stretch lg:justify-start lg:gap-4 lg:p-5 ${
                isEmpty ? 'max-lg:hidden' : ''
            }`}
        >
            <h3 className="font-display hidden text-lg font-bold text-oxford-navy-700 lg:block">
                {t('services.summary.title')}
            </h3>

            {isEmpty ? (
                <p className="text-sm leading-relaxed text-oxford-navy-900/65">
                    {t('services.summary.empty')}
                </p>
            ) : (
                <div className="flex flex-col">
                    <span className="text-xs text-oxford-navy-900/65 sm:text-sm">
                        {t('services.summary.selected', { count })}
                    </span>
                    <span className="text-lg font-bold text-oxford-navy-700 lg:text-2xl">
                        {rupiah(total)}
                    </span>
                    <span className="hidden text-xs text-oxford-navy-900/65 lg:block">
                        {t('services.summary.estimate')}
                    </span>
                </div>
            )}

            {!isEmpty && hint && (
                <div className="hidden rounded-xl bg-forest-moss-100 px-3.5 py-3 text-sm leading-relaxed text-forest-moss-800 lg:block">
                    {hint}
                </div>
            )}

            <div className="flex shrink-0 flex-col items-stretch gap-2">
                <Button
                    variant="primary"
                    disabled={isEmpty}
                    onClick={onStart}
                    className="whitespace-nowrap max-lg:px-3 max-lg:py-2.5"
                >
                    {t('services.summary.continue')}
                </Button>
                {!isEmpty && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-sm font-medium text-oxford-navy-700 hover:cursor-pointer hover:underline max-lg:hidden"
                    >
                        {t('services.summary.clear')}
                    </button>
                )}
                {!isEmpty && !isAuthenticated && (
                    <p className="text-center text-xs text-oxford-navy-900/65 max-lg:hidden">
                        {t('services.summary.loginNote')}
                    </p>
                )}
            </div>
        </aside>
    );
}
