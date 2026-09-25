import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowRightLine, RiCalendarLine, RiTimeLine } from '@remixicon/react';
import ChapterCover from '@/components/bookChapter/ChapterCover';
import { useContentLanguages } from '@/components/language/useContentLanguages';
import { useFormat } from '@/i18n/useFormat';
import { toContentLanguages } from '@/lib/contentLanguages';
import {
    categoryNames,
    openPrice,
    summarizeSlots,
    type ChapterProject,
} from '@/lib/bookChapterPublic';

/**
 * Kartu proyek Book Chapter di halaman daftar: sampul A5 (sampul bawaan bila
 * kosong), kategori, judul, editor, jadwal, slot terisi, harga per bab, dan
 * tombol menuju detail.
 */
export default function ChapterProjectCard({
    project,
}: {
    project: ChapterProject;
}) {
    const { t } = useTranslation();
    const { rupiah, dateLong, monthYear } = useFormat();
    const { metaLine } = useContentLanguages();
    const languages = toContentLanguages(project.languages);
    const { total, open, taken } = summarizeSlots(project.chapters);
    const price = openPrice(project.chapters);
    const categories = categoryNames(project);
    const publish = project.estimated_publish_date
        ? monthYear(project.estimated_publish_date)
        : null;
    const deadline = project.submission_deadline
        ? dateLong(project.submission_deadline)
        : null;
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

    return (
        <article className="group relative flex h-full min-w-0 flex-col rounded-2xl border border-forest-moss-100 bg-white p-3 shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-14px_rgba(1,26,44,0.34)] sm:p-4">
            {project.discount > 0 && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-forest-moss-600 px-2.5 py-1 text-[11px] font-semibold leading-none text-white shadow-sm sm:right-4 sm:top-4 sm:text-xs">
                    {t('common.discount', { percent: project.discount })}
                </span>
            )}

            <Link
                to={`/buku-bab/${project.id}`}
                className="flex flex-col gap-3"
            >
                <div className="flex justify-center rounded-xl bg-linear-to-b from-oxford-navy-50/80 via-white to-white px-3 pb-5 pt-9">
                    <ChapterCover
                        src={project.front_cover}
                        title={project.title}
                        alt=""
                        className="w-[64%] transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                </div>

                {/* Tinggi baris kategori dijaga agar judul antar kartu sejajar */}
                <div className="flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
                    {categories.map((name) => (
                        <span
                            key={name}
                            className="max-w-full truncate rounded-full bg-forest-moss-100 px-2.5 py-1 text-[11px] font-medium leading-none text-forest-moss-800"
                        >
                            {name}
                        </span>
                    ))}
                </div>

                <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug text-oxford-navy-900 transition-colors group-hover:text-oxford-navy-600">
                    {project.title}
                </h3>
            </Link>

            <div className="mt-2 flex flex-1 flex-col gap-3">
                {project.owner_editor && (
                    <p className="line-clamp-1 text-[13px] text-oxford-navy-900/70">
                        {t('bookChapter.card.editor', {
                            name: project.owner_editor.name,
                        })}
                    </p>
                )}

                {languages.length > 0 && (
                    <p className="line-clamp-1 text-[13px] text-oxford-navy-900/70">
                        {metaLine(languages)}
                    </p>
                )}

                {(publish || deadline) && (
                    <ul className="flex flex-col gap-1 text-xs text-oxford-navy-900/60">
                        {publish && (
                            <li className="flex items-center gap-1.5">
                                <RiCalendarLine
                                    aria-hidden
                                    className="size-4 shrink-0 text-oxford-navy-700"
                                />
                                {t('bookChapter.card.estimatedPublish', {
                                    date: publish,
                                })}
                            </li>
                        )}
                        {deadline && (
                            <li className="flex items-center gap-1.5">
                                <RiTimeLine
                                    aria-hidden
                                    className="size-4 shrink-0 text-oxford-navy-700"
                                />
                                {t('bookChapter.card.deadline', {
                                    date: deadline,
                                })}
                            </li>
                        )}
                    </ul>
                )}

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-forest-moss-700">
                            {t('bookChapter.card.slotsOpen', { count: open })}
                        </span>
                        <span className="text-oxford-navy-900/50">
                            {t('bookChapter.card.slotsFilled', {
                                taken,
                                total,
                            })}
                        </span>
                    </div>
                    <div
                        role="progressbar"
                        aria-label={t('bookChapter.card.progressAria')}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={taken}
                        className="h-2 overflow-hidden rounded-full bg-forest-moss-100"
                    >
                        <div
                            className="h-full rounded-full bg-forest-moss-500 transition-[width] duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {price ? (
                            <>
                                {price.hasRange && (
                                    <span className="text-xs text-oxford-navy-900/55">
                                        {t('bookChapter.card.from')}
                                    </span>
                                )}
                                {price.original !== null && (
                                    <span className="text-xs text-oxford-navy-900/45 line-through sm:text-sm">
                                        {rupiah(price.original)}
                                    </span>
                                )}
                                <span className="text-base font-bold text-oxford-navy-700 sm:text-lg">
                                    {rupiah(price.from)}
                                </span>
                                <span className="text-xs text-oxford-navy-900/55">
                                    {t('bookChapter.card.perChapter')}
                                </span>
                            </>
                        ) : (
                            <span className="text-sm font-medium text-oxford-navy-900/55">
                                {t('bookChapter.card.allFilled')}
                            </span>
                        )}
                    </div>

                    <Link
                        to={`/buku-bab/${project.id}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-oxford-navy-700 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-oxford-navy-600 sm:text-sm"
                    >
                        {t('bookChapter.card.view')}
                        <RiArrowRightLine aria-hidden className="size-4" />
                    </Link>
                </div>
            </div>
        </article>
    );
}

// Kerangka kartu saat data dimuat — bentuknya sama dengan kartu asli.
export function ChapterProjectCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex h-full animate-pulse flex-col rounded-2xl border border-forest-moss-100 bg-white p-3 sm:p-4"
        >
            <div className="flex justify-center rounded-xl bg-oxford-navy-50/70 px-3 pb-5 pt-9">
                <div className="aspect-[148/210] w-[64%] rounded bg-oxford-navy-100/70" />
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
                <div className="h-5 w-24 rounded-full bg-oxford-navy-100/60" />
                <div className="h-4 w-full rounded bg-oxford-navy-100/60" />
                <div className="h-4 w-2/3 rounded bg-oxford-navy-100/60" />
                <div className="h-3 w-1/2 rounded bg-oxford-navy-100/60" />
                <div className="h-2 w-full rounded-full bg-oxford-navy-100/60" />
                <div className="mt-2 h-5 w-1/2 rounded bg-oxford-navy-100/60" />
                <div className="h-10 w-full rounded-lg bg-oxford-navy-100/60" />
            </div>
        </div>
    );
}
