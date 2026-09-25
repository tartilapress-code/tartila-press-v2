import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowRightLine } from '@remixicon/react';
import Card2Flip, {
    PackageCardSkeleton,
} from '@/components/card/flipcard/Card2Flip';
import PackageComparison from '@/components/package/PackageComparison';
import { usePackages } from '@/hooks/usePackages';

// Beranda hanya menampilkan sebagian; sisanya ada di halaman /paket.
const LIMIT = 4;

/**
 * Paket di beranda: maksimal empat kartu, lalu tabel perbandingan untuk
 * paket-paket itu. Daftar lengkap dan tabel semua paket ada di /paket.
 */
export default function HomePackages(): ReactNode {
    const { t } = useTranslation();
    const { packages, isLoading } = usePackages();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: LIMIT }).map((_, index) => (
                    <PackageCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (packages.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                {t('packages.empty')}
            </p>
        );
    }

    const shown = packages.slice(0, LIMIT);

    return (
        <div className="flex flex-col gap-10">
            <Card2Flip packages={shown} />

            {shown.length >= 2 && (
                <section
                    aria-labelledby="bandingkan-paket-beranda"
                    className="flex flex-col gap-4"
                >
                    <h3
                        id="bandingkan-paket-beranda"
                        className="font-display text-xl font-bold text-oxford-navy-700"
                    >
                        {t('packages.compare')}
                    </h3>
                    <PackageComparison packages={shown} />
                </section>
            )}

            {packages.length > LIMIT && (
                <div className="flex justify-center">
                    <Link
                        to="/paket"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-oxford-navy-200 bg-white px-5 py-3 text-sm font-semibold text-oxford-navy-700 transition-colors hover:bg-forest-moss-50"
                    >
                        {t('packages.seeAllCount', { count: packages.length })}
                        <RiArrowRightLine aria-hidden className="size-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}
