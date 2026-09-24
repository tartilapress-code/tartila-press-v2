import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RiCheckLine, RiLeafLine } from '@remixicon/react';

import PillBadge from '@/components/ui/PillBadge';
import type { PackageSummary } from '@/data/package/packageApi';
import { formatRupiah } from '@/lib/bookChapterPublic';
import type { PackageHighlight } from '@/lib/packageFeatures';

type Card2Props = {
    packages: PackageSummary[];
    // Lencana/catatan hemat per paket (id paket → keterangan).
    highlights?: Record<number, PackageHighlight>;
    // Jumlah kolom terlebar; 3 untuk daftar pendek supaya tidak ada kolom kosong.
    maxColumns?: 3 | 4;
};

/**
 * Kartu paket penerbitan (tema terang): depan berisi foto, kategori, nama, dan
 * harga; klik kartu (atau tombol "Fasilitas") membaliknya ke daftar
 * fasilitas dan layanan.
 */
export default function Card2({
    packages,
    highlights = {},
    maxColumns = 4,
}: Card2Props) {
    const [flipped, setFlipped] = useState<Set<number>>(new Set<number>());

    const toogleFlipped = (id: number) => {
        setFlipped((previous) => {
            const next = new Set(previous);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    return (
        <div
            className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${
                maxColumns === 4 ? 'xl:grid-cols-4' : ''
            }`}
        >
            {packages.map((pkg) => {
                const isFlipped = flipped.has(pkg.id);
                const highlight = highlights[pkg.id];
                const items = [
                    ...(pkg.facilities ?? []),
                    ...(pkg.services ?? []),
                ];

                return (
                    <div
                        key={pkg.id}
                        className="cursor-pointer perspective-[1000px]"
                        onClick={() => toogleFlipped(pkg.id)}
                    >
                        <div
                            className={`relative h-[28rem] transform-3d transition-transform duration-700 ${
                                isFlipped ? 'rotate-y-180' : ''
                            }`}
                        >
                            {/* Depan */}
                            <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] backface-hidden">
                                <div className="relative h-44 shrink-0 bg-linear-to-br from-forest-moss-50 to-forest-moss-100">
                                    {pkg.photo ? (
                                        <img
                                            src={pkg.photo}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-forest-moss-500">
                                            <RiLeafLine
                                                aria-hidden
                                                className="size-12"
                                            />
                                        </div>
                                    )}
                                    {pkg.discount > 0 && (
                                        <span className="absolute left-3 top-3 rounded-full bg-forest-moss-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                                            Diskon {pkg.discount}%
                                        </span>
                                    )}
                                    {highlight?.badge && (
                                        <span className="absolute right-3 top-3 rounded-full bg-oxford-navy-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                                            {highlight.badge}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col gap-3 p-5">
                                    {pkg.category && (
                                        <PillBadge label={pkg.category} />
                                    )}
                                    <h4 className="font-display line-clamp-2 text-xl font-bold leading-snug text-oxford-navy-700">
                                        {pkg.name}
                                    </h4>
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        {pkg.discount > 0 && (
                                            <span className="text-sm text-oxford-navy-900/65 line-through">
                                                {formatRupiah(
                                                    Number(pkg.price)
                                                )}
                                            </span>
                                        )}
                                        <span className="text-lg font-bold text-oxford-navy-700">
                                            {formatRupiah(pkg.final_price)}
                                        </span>
                                    </div>
                                    {highlight?.note && (
                                        <p className="text-xs font-semibold text-forest-moss-700">
                                            {highlight.note}
                                        </p>
                                    )}

                                    <div className="mt-auto flex flex-row items-center gap-2">
                                        <Link
                                            to={`/paket/${pkg.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex flex-1 items-center justify-center rounded-lg bg-oxford-navy-700 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                                        >
                                            Lihat Detail
                                        </Link>
                                        <button
                                            type="button"
                                            aria-pressed={isFlipped}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toogleFlipped(pkg.id);
                                            }}
                                            className="inline-flex items-center justify-center rounded-lg border border-oxford-navy-200 px-3 py-2.5 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-forest-moss-50"
                                        >
                                            Fasilitas
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Belakang */}
                            <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-forest-moss-200 bg-forest-moss-100/80 p-6 backface-hidden rotate-y-180">
                                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                                    Fasilitas & Layanan
                                </h5>
                                {items.length > 0 ? (
                                    <ul className="flex flex-col gap-2 text-oxford-navy-900/80">
                                        {items.map((item, index) => (
                                            <li
                                                key={`${index}-${item}`}
                                                className="flex items-start gap-2.5 text-[15px]"
                                            >
                                                <RiCheckLine
                                                    aria-hidden
                                                    className="mt-0.5 size-5 shrink-0 text-forest-moss-700"
                                                />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-oxford-navy-900/65">
                                        Rincian fasilitas belum tersedia.
                                    </p>
                                )}
                                <p className="mt-auto text-xs text-oxford-navy-900/65">
                                    Klik kartu untuk kembali.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Kerangka kartu paket saat data masih dimuat. */
export function PackageCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex h-[28rem] animate-pulse flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white"
        >
            <div className="h-44 shrink-0 bg-forest-moss-50" />
            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="h-6 w-24 rounded-full bg-forest-moss-100" />
                <div className="h-6 w-4/5 rounded bg-forest-moss-100" />
                <div className="h-5 w-2/5 rounded bg-forest-moss-50" />
                <div className="mt-auto h-10 w-full rounded-lg bg-forest-moss-100" />
            </div>
        </div>
    );
}
