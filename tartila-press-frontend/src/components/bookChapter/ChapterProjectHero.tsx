import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiCalendarLine, RiTimeLine, RiUserLine } from '@remixicon/react';
import {
    BookStackLine,
    HeroHill,
    HeroLeafRight,
} from '@/components/art/HeroArt';
import ChapterCover from '@/components/bookChapter/ChapterCover';
import PillBadge from '@/components/ui/PillBadge';
import {
    categoryNames,
    formatDate,
    formatMonthYear,
    formatRupiah,
    openPrice,
    summarizeSlots,
    type ChapterProject,
} from '@/lib/bookChapterPublic';

type MetaItem = { key: string; icon: ReactNode; text: string };

/**
 * Hero detail proyek Book Chapter: sampul A5 (bawaan bila kosong), lencana
 * dan kategori, judul serif, editor & jadwal, harga per bab, progres slot,
 * dan tombol menuju daftar bab.
 */
export default function ChapterProjectHero({
    project,
    deadlinePassed,
    onPickChapter,
}: {
    project: ChapterProject;
    deadlinePassed: boolean;
    onPickChapter: () => void;
}) {
    const { total, open, taken } = summarizeSlots(project.chapters);
    const price = openPrice(project.chapters);
    const publish = formatMonthYear(project.estimated_publish_date);
    const deadline = formatDate(project.submission_deadline);
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

    const meta: MetaItem[] = [];

    if (project.owner_editor) {
        meta.push({
            key: 'editor',
            icon: <RiUserLine />,
            text: `Editor: ${project.owner_editor.name}`,
        });
    }
    if (publish) {
        meta.push({
            key: 'publish',
            icon: <RiCalendarLine />,
            text: `Perkiraan terbit ${publish}`,
        });
    }
    if (deadline) {
        meta.push({
            key: 'deadline',
            icon: <RiTimeLine />,
            text: `Batas naskah ${deadline}`,
        });
    }

    return (
        <section className="relative isolate overflow-hidden bg-white">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[20%] sm:block" />

            <div className="relative mx-auto flex max-w-[1232px] flex-col items-center gap-6 px-6 py-8 text-center sm:flex-row sm:gap-8 sm:px-10 sm:py-10 sm:text-left lg:pl-16 lg:pr-[24%]">
                <div className="relative shrink-0">
                    <ChapterCover
                        src={project.front_cover}
                        title={project.title}
                        className="w-40 sm:w-44 lg:w-48"
                    />
                    {project.discount > 0 && (
                        <span className="absolute -right-3 -top-3 rounded-full bg-forest-moss-600 px-3 py-1.5 text-xs font-semibold leading-none text-white shadow-md">
                            Diskon {project.discount}%
                        </span>
                    )}
                </div>

                <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        <PillBadge label="Book Chapter" withIcon />
                        {categoryNames(project).map((name) => (
                            <PillBadge key={name} label={name} />
                        ))}
                    </div>

                    <h1 className="font-display break-words text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl xl:text-5xl">
                        {project.title}
                    </h1>

                    {meta.length > 0 && (
                        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-oxford-navy-900/70 sm:justify-start">
                            {meta.map((item) => (
                                <li
                                    key={item.key}
                                    className="inline-flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="text-oxford-navy-700 [&>svg]:size-[18px]"
                                    >
                                        {item.icon}
                                    </span>
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-1 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:justify-start">
                        <div>
                            <p className="text-xs text-oxford-navy-900/55">
                                Harga per bab
                            </p>
                            {price ? (
                                <p className="mt-0.5 flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start">
                                    {price.original !== null && (
                                        <span className="text-sm text-oxford-navy-900/45 line-through">
                                            {formatRupiah(price.original)}
                                        </span>
                                    )}
                                    <span className="text-3xl font-bold text-oxford-navy-700">
                                        {formatRupiah(price.from)}
                                    </span>
                                    {price.hasRange && (
                                        <span className="text-xs text-oxford-navy-900/55">
                                            (harga terendah)
                                        </span>
                                    )}
                                </p>
                            ) : (
                                <p className="mt-0.5 text-lg font-semibold text-oxford-navy-900/60">
                                    {total === 0
                                        ? 'Belum ada bab'
                                        : 'Semua slot sudah terisi'}
                                </p>
                            )}
                        </div>

                        <div className="w-52">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-forest-moss-700">
                                    {open} slot terbuka
                                </span>
                                <span className="text-oxford-navy-900/50">
                                    {taken}/{total} terisi
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-label="Slot bab yang sudah terisi"
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={taken}
                                className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest-moss-100"
                            >
                                <div
                                    className="h-full rounded-full bg-forest-moss-500"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {deadlinePassed && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                            Batas pengumpulan naskah sudah lewat — pembelian
                            slot ditutup.
                        </p>
                    )}

                    <div className="mt-1 flex flex-wrap justify-center gap-3 sm:justify-start">
                        {open > 0 && !deadlinePassed && (
                            <button
                                type="button"
                                onClick={onPickChapter}
                                className="inline-flex items-center justify-center rounded-lg bg-oxford-navy-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:cursor-pointer hover:bg-oxford-navy-600"
                            >
                                Pilih Bab
                            </button>
                        )}
                        <Link
                            to="/buku-bab"
                            className="inline-flex items-center justify-center rounded-lg border border-oxford-navy-700 px-5 py-3 text-sm font-semibold text-oxford-navy-700 transition-colors hover:bg-oxford-navy-700 hover:text-white"
                        >
                            Semua Proyek
                        </Link>
                    </div>
                </div>
            </div>

            <BookStackLine className="pointer-events-none absolute bottom-0 right-[6%] hidden h-[215px] w-auto lg:block" />
        </section>
    );
}
