import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowRightUpLine } from '@remixicon/react';
import type { HeroCover } from '@/data/book/bookApi';
import photo from '../../../assets/images/buku.png';
import BookShelfScene from './BookShelfScene';

/** Daun hijau lembut (dekoratif) di sudut etalase. */
function Leaves({ className }: { className: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            aria-hidden
            className={`pointer-events-none absolute ${className}`}
        >
            <path
                d="M20 190C60 140 100 90 180 20"
                className="fill-none stroke-forest-moss-500/60"
                strokeWidth="3"
            />
            {[
                { x: 60, y: 140, r: -20 },
                { x: 90, y: 105, r: 200 },
                { x: 118, y: 75, r: -35 },
                { x: 146, y: 46, r: 215 },
                { x: 40, y: 165, r: 190 },
            ].map((leaf, index) => (
                <ellipse
                    key={index}
                    cx={leaf.x}
                    cy={leaf.y}
                    rx="30"
                    ry="11"
                    transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
                    className={
                        index % 2 === 0
                            ? 'fill-forest-moss-400/60'
                            : 'fill-forest-moss-300/70'
                    }
                />
            ))}
        </svg>
    );
}

/** Kartu hijau muda di belakang panel, memberi kesan bingkai ganda. */
function Backdrop() {
    return (
        <div
            aria-hidden
            className="absolute -left-3 -top-3 h-full w-full rounded-[2.25rem] bg-forest-moss-100 ring-1 ring-forest-moss-200 sm:-left-4 sm:-top-4"
        />
    );
}

const panelClass =
    'relative overflow-hidden rounded-[2rem] border-[6px] border-white bg-linear-to-br from-forest-moss-50 via-forest-moss-100 to-forest-moss-200/80 shadow-[0_28px_56px_-28px_rgba(1,26,44,0.55)] ring-1 ring-forest-moss-200';

const pillClass =
    'rounded-full bg-white px-3 py-1 text-forest-moss-800 ring-1 ring-forest-moss-200';

/** Kerangka saat data belum termuat. */
export function HeroShowcaseSkeleton() {
    return (
        <div aria-hidden className="relative w-full">
            <Backdrop />
            <div className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
                <div className="relative aspect-[100/62] w-full">
                    <div className="absolute inset-x-[12%] inset-y-[8%] animate-pulse rounded-2xl bg-white/60" />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="h-6 w-48 animate-pulse rounded-full bg-white/70" />
                    <span className="h-6 w-2/3 animate-pulse rounded-full bg-white/70" />
                </div>
            </div>
        </div>
    );
}

/**
 * Etalase hero beranda (warna tema situs: hijau forest-moss & navy): rak
 * buku 3D dengan buku terbaru dipajang menghadap depan (lihat
 * BookShelfScene) dan keterangan buku terbitan terbaru. Tanpa
 * sampul → foto rak buku.
 */
export default function HeroShowcase({ covers }: { covers: HeroCover[] }) {
    const { t } = useTranslation();
    const shown = covers.slice(0, 3);
    const latest = shown[0];

    if (!latest) {
        return (
            <div className="relative w-full">
                <Backdrop />
                <img
                    src={photo}
                    alt={t('home.hero.photoAlt')}
                    className="relative aspect-[4/3] w-full rounded-[2rem] border-[6px] border-white object-cover shadow-[0_18px_44px_-18px_rgba(1,26,44,0.5)]"
                />
            </div>
        );
    }

    return (
        <div className="relative w-full">
            <Backdrop />
            <div className={panelClass}>
                <Leaves className="-right-10 -top-10 w-44 rotate-12 blur-[2px]" />
                <Leaves className="-bottom-12 -left-12 w-40 -rotate-[160deg] blur-[3px]" />

                <div className="relative flex flex-col gap-4 p-5 sm:p-7">
                    <BookShelfScene covers={shown} />

                    <div className="relative flex items-end justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-2">
                            <p className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                                <span className={pillClass}>
                                    {t('home.hero.latestLabel')}
                                </span>
                                {latest.category && (
                                    <span className={pillClass}>
                                        {latest.category}
                                    </span>
                                )}
                            </p>
                            <p className="font-display line-clamp-2 text-2xl font-bold leading-tight text-oxford-navy-700">
                                {latest.title}
                            </p>
                            {latest.authors && (
                                <p className="line-clamp-1 text-sm text-oxford-navy-900/75">
                                    {t('home.hero.latestBy', {
                                        authors: latest.authors,
                                    })}
                                </p>
                            )}
                        </div>
                        <Link
                            to={`/buku/${latest.slug}`}
                            aria-label={t('home.hero.coverLink', {
                                title: latest.title,
                            })}
                            title={t('home.hero.latestView')}
                            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-oxford-navy-700 text-white shadow-lg ring-[3px] ring-forest-moss-300 ring-offset-2 ring-offset-forest-moss-100 transition-colors hover:bg-oxford-navy-600"
                        >
                            <RiArrowRightUpLine size={22} aria-hidden />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
