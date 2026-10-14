import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RiArrowUpDownLine,
    RiBarcodeLine,
    RiLayoutGridLine,
    RiRestartLine,
} from '@remixicon/react';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import ChapterHowItWorks from '@/components/bookChapter/ChapterHowItWorks';
import ChapterProjectCard, {
    ChapterProjectCardSkeleton,
} from '@/components/bookChapter/ChapterProjectCard';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import Pagination from '@/components/ui/Pagination';
import QuoteCard from '@/components/ui/QuoteCard';
import SectionTitle from '@/components/ui/SectionTitle';
import type { ChapterProject } from '@/lib/bookChapterPublic';
import type { PageMeta } from '@/lib/pagination';

type SortMode = 'newest' | 'deadline' | 'price' | 'slots';

const SKELETON_COUNT = 6;

/**
 * Halaman daftar Book Chapter: hero, kartu "Cara Kerja", dan daftar proyek
 * yang masih punya slot bab terbuka lengkap dengan pencarian, kategori,
 * dan urutan.
 */
export default function BookChapterProjectListPage() {
    const { t } = useTranslation();
    const sortOptions = [
        { value: 'newest', label: t('bookChapter.list.sort.newest') },
        { value: 'deadline', label: t('bookChapter.list.sort.deadline') },
        { value: 'price', label: t('bookChapter.list.sort.price') },
        { value: 'slots', label: t('bookChapter.list.sort.slots') },
    ];
    const [projects, setProjects] = useState<ChapterProject[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [query, setQuery] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [sort, setSort] = useState<SortMode>('newest');
    const [isbnType, setIsbnType] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const listRef = useRef<HTMLElement>(null);

    // Pencarian, kategori, urutan & halaman dikerjakan server.
    useEffect(() => {
        let cancelled = false;

        const timeout = setTimeout(() => {
            setIsLoading(true);

            bookChapterProjectApi
                .list({
                    search: query.trim(),
                    category,
                    isbn_type: isbnType,
                    sort,
                    page,
                })
                .then((response) => {
                    if (cancelled) return;
                    setProjects(response.data);
                    setMeta(response.meta ?? null);
                    setCategories(response.meta?.categories ?? []);
                })
                .catch(() => {
                    if (cancelled) return;
                    setProjects([]);
                    setMeta(null);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query, category, isbnType, sort, page]);

    const hasFilters =
        query.trim() !== '' || category !== '' || isbnType !== '';
    const total = meta?.total ?? projects.length;

    function changeQuery(value: string) {
        setQuery(value);
        setPage(1);
    }

    function changeCategory(value: string) {
        setCategory(value);
        setPage(1);
    }

    function changeIsbnType(value: string) {
        setIsbnType(value);
        setPage(1);
    }

    function changeSort(value: SortMode) {
        setSort(value);
        setPage(1);
    }

    function changePage(next: number) {
        setPage(next);
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetFilters() {
        setQuery('');
        setCategory('');
        setPage(1);
    }

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge={t('bookChapter.badge')}
                title={{
                    before: t('bookChapter.list.heroBefore'),
                    accent: t('bookChapter.list.heroAccent'),
                    after: t('bookChapter.list.heroAfter'),
                }}
                text={t('bookChapter.list.heroText')}
                script={[
                    t('bookChapter.list.scriptTop'),
                    t('bookChapter.list.scriptBottom'),
                ]}
            />

            <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:px-10">
                <aside className="order-last lg:order-none">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <ChapterHowItWorks />
                        <QuoteCard quote={t('bookChapter.list.quote')} />
                    </div>
                </aside>

                <section
                    ref={listRef}
                    aria-labelledby="chapter-list-title"
                    className="flex min-w-0 flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4">
                        <SectionTitle id="chapter-list-title">
                            {t('bookChapter.list.title')}
                            {!isLoading && total > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/65">
                                    {t('bookChapter.list.count', {
                                        count: total,
                                    })}
                                </span>
                            )}
                        </SectionTitle>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_13rem_13rem]">
                            <SearchField
                                value={query}
                                onChange={changeQuery}
                                placeholder={t(
                                    'bookChapter.list.searchPlaceholder'
                                )}
                                ariaLabel={t('bookChapter.list.searchAria')}
                                className="sm:col-span-2 xl:col-span-1"
                            />
                            <SelectField
                                value={category}
                                onChange={changeCategory}
                                options={[
                                    {
                                        value: '',
                                        label: t(
                                            'bookChapter.list.allCategories'
                                        ),
                                    },
                                    ...categories.map((name) => ({
                                        value: name,
                                        label: name,
                                    })),
                                ]}
                                ariaLabel={t('bookChapter.list.categoryAria')}
                                icon={<RiLayoutGridLine />}
                            />
                            <SelectField
                                value={isbnType}
                                onChange={changeIsbnType}
                                options={[
                                    { value: '', label: t('isbn.filter.all') },
                                    {
                                        value: 'print',
                                        label: t('isbn.types.print.label'),
                                    },
                                    {
                                        value: 'electronic',
                                        label: t('isbn.types.electronic.label'),
                                    },
                                    {
                                        value: 'both',
                                        label: t('isbn.types.both.label'),
                                    },
                                ]}
                                ariaLabel={t('isbn.filter.label')}
                                icon={<RiBarcodeLine />}
                            />
                            <SelectField
                                value={sort}
                                onChange={(value) =>
                                    changeSort(value as SortMode)
                                }
                                options={sortOptions}
                                ariaLabel={t('bookChapter.list.sortAria')}
                                icon={<RiArrowUpDownLine />}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: SKELETON_COUNT }).map(
                                (_, index) => (
                                    <ChapterProjectCardSkeleton key={index} />
                                )
                            )}
                        </div>
                    ) : projects.length === 0 && !hasFilters ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            {t('bookChapter.list.empty')}
                        </p>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50 px-6 py-14 text-center">
                            <p className="text-sm text-oxford-navy-900/70">
                                {t('bookChapter.list.noMatch')}
                            </p>
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                                >
                                    <RiRestartLine
                                        aria-hidden
                                        className="size-4"
                                    />
                                    {t('bookChapter.list.reset')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {projects.map((project) => (
                                    <ChapterProjectCard
                                        key={project.id}
                                        project={project}
                                    />
                                ))}
                            </div>
                            <Pagination meta={meta} onPageChange={changePage} />
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
