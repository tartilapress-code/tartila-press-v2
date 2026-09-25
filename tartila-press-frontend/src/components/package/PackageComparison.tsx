import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiCheckLine } from '@remixicon/react';
import PillBadge from '@/components/ui/PillBadge';
import type { PackageSummary } from '@/data/package/packageApi';
import { useFormat } from '@/i18n/useFormat';
import { comparisonFeatures } from '@/lib/packageFeatures';
import type { ComparisonFeature } from '@/lib/packageFeatures';

// Kolom nama paket menempel di kiri saat tabel digeser ke samping.
const stickyName = 'sticky left-0 z-10 border-r border-forest-moss-100';
// Garis pemisah di kolom pertama tiap kelompok (layanan / fasilitas).
const groupDivider = 'border-l border-forest-moss-100';

function GroupHeader({
    title,
    span,
}: {
    title: string;
    span: number;
}): ReactNode {
    if (span === 0) {
        return null;
    }

    return (
        <th
            scope="colgroup"
            colSpan={span}
            className={`${groupDivider} border-b border-forest-moss-100 bg-forest-moss-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-oxford-navy-900/65`}
        >
            {title}
        </th>
    );
}

function FeatureHeaders({
    features,
}: {
    features: ComparisonFeature[];
}): ReactNode {
    return features.map((feature, index) => (
        <th
            key={feature.key}
            scope="col"
            className={`${
                index === 0 ? groupDivider : ''
            } min-w-24 bg-forest-moss-50 px-2 py-3 text-center align-middle text-[13px] font-semibold leading-snug text-oxford-navy-900 first-letter:uppercase`}
        >
            {feature.label}
        </th>
    ));
}

function FeatureCells({
    features,
    packageIndex,
}: {
    features: ComparisonFeature[];
    packageIndex: number;
}): ReactNode {
    const { t } = useTranslation();

    return features.map((feature, index) => (
        <td
            key={feature.key}
            className={`${
                index === 0 ? groupDivider : ''
            } border-t border-forest-moss-100 px-2 py-3.5 text-center align-middle`}
        >
            {feature.has[packageIndex] ? (
                <>
                    <span
                        aria-hidden
                        className="mx-auto flex size-6 items-center justify-center rounded-full bg-forest-moss-100 text-forest-moss-700"
                    >
                        <RiCheckLine className="size-4" />
                    </span>
                    <span className="sr-only">{t('common.included')}</span>
                </>
            ) : (
                <>
                    <span aria-hidden className="text-oxford-navy-900/30">
                        –
                    </span>
                    <span className="sr-only">{t('common.notIncluded')}</span>
                </>
            )}
        </td>
    ));
}

/**
 * Tabel perbandingan paket: satu baris per paket dengan kolom Nama Paket,
 * Harga, lalu satu kolom per layanan dan per fasilitas (nama di header) yang
 * diberi tanda centang bila paket memilikinya. Di layar sempit tabel bisa
 * digeser ke samping dan kolom nama paket tetap terlihat.
 */
export default function PackageComparison({
    packages,
}: {
    packages: PackageSummary[];
}): ReactNode {
    const { t } = useTranslation();
    const { rupiah } = useFormat();
    const services = comparisonFeatures(packages, (pkg) => pkg.services);
    const facilities = comparisonFeatures(packages, (pkg) => pkg.facilities);

    if (services.length === 0 && facilities.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-10 text-center text-sm text-oxford-navy-900/65">
                {t('packages.table.empty')}
            </p>
        );
    }

    return (
        // `relative`: teks `sr-only` di dalam sel bersifat absolute — tanpa ini ia
        // lolos dari pemotongan overflow dan melebarkan halaman di ponsel.
        <div className="relative overflow-x-auto rounded-2xl border border-forest-moss-100 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)]">
            <table className="w-full border-separate border-spacing-0 text-left">
                <caption className="sr-only">
                    {t('packages.table.caption')}
                </caption>
                <thead>
                    <tr>
                        <th
                            scope="col"
                            rowSpan={2}
                            className={`${stickyName} min-w-32 bg-forest-moss-50 px-3 py-3 text-left align-middle text-sm font-semibold text-oxford-navy-700 sm:min-w-44 sm:px-4`}
                        >
                            {t('packages.table.name')}
                        </th>
                        <th
                            scope="col"
                            rowSpan={2}
                            className="min-w-32 bg-forest-moss-50 px-4 py-3 text-left align-middle text-sm font-semibold text-oxford-navy-700"
                        >
                            {t('packages.table.price')}
                        </th>
                        <GroupHeader
                            title={t('packages.table.services')}
                            span={services.length}
                        />
                        <GroupHeader
                            title={t('packages.table.facilities')}
                            span={facilities.length}
                        />
                    </tr>
                    <tr>
                        <FeatureHeaders features={services} />
                        <FeatureHeaders features={facilities} />
                    </tr>
                </thead>

                <tbody>
                    {packages.map((pkg, index) => (
                        <tr key={pkg.id}>
                            <th
                                scope="row"
                                className={`${stickyName} border-t bg-white px-3 py-3.5 text-left align-middle sm:px-4`}
                            >
                                <Link
                                    to={`/paket/${pkg.id}`}
                                    className="font-display text-base font-bold leading-snug text-oxford-navy-700 hover:underline"
                                >
                                    {pkg.name}
                                </Link>
                                {pkg.category && (
                                    <div className="mt-1.5">
                                        <PillBadge label={pkg.category} />
                                    </div>
                                )}
                            </th>
                            <td className="whitespace-nowrap border-t border-forest-moss-100 px-4 py-3.5 align-middle">
                                <div className="flex flex-col leading-tight">
                                    {pkg.discount > 0 && (
                                        <span className="text-xs text-oxford-navy-900/65 line-through">
                                            {rupiah(Number(pkg.price))}
                                        </span>
                                    )}
                                    <span className="text-base font-bold text-oxford-navy-700">
                                        {rupiah(pkg.final_price)}
                                    </span>
                                </div>
                            </td>
                            <FeatureCells
                                features={services}
                                packageIndex={index}
                            />
                            <FeatureCells
                                features={facilities}
                                packageIndex={index}
                            />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
