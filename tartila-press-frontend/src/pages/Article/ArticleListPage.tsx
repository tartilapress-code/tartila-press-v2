import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiLayoutGridLine, RiRestartLine } from '@remixicon/react';
import ArticleCard from '@/components/article/ArticleCard';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import Pagination from '@/components/ui/Pagination';
import SectionTitle from '@/components/ui/SectionTitle';
import * as articleApi from '@/data/article/articleApi';
import type { Article } from '@/data/article/articleApi';
import type { PageMeta } from '@/lib/pagination';

const SKELETON_COUNT = 6;

function ArticleCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex h-full animate-pulse flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white"
        >
            <div className="h-44 bg-forest-moss-50" />
            <div className="flex flex-col gap-3 p-5">
                <div className="h-3 w-16 rounded bg-forest-moss-100" />
                <div className="h-5 w-4/5 rounded bg-forest-moss-100" />
                <div className="h-4 w-full rounded bg-forest-moss-50" />
                <div className="h-4 w-2/3 rounded bg-forest-moss-50" />
            </div>
        </div>
    );
}

export default function ArticleListPage() {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [query, setQuery] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [featured, setFeatured] = useState<Article[]>([]);
    const listRef = useRef<HTMLElement>(null);

    const hasFilters = query.trim() !== '' || category !== '';

    // Pencarian, kategori & halaman dikerjakan server. Tanpa filter, artikel
    // terbaru dan paling disukai datang terpisah (meta.highlights).
    useEffect(() => {
        let cancelled = false;

        const timeout = setTimeout(() => {
            setIsLoading(true);

            articleApi
                .list({
                    search: query.trim(),
                    category,
                    page,
                    highlight: 1,
                })
                .then((response) => {
                    if (cancelled) return;
                    setArticles(response.data);
                    setMeta(response.meta ?? null);
                    setCategories(response.meta?.categories ?? []);
                    setFeatured(response.meta?.highlights ?? []);
                })
                .catch(() => {
                    if (cancelled) return;
                    setArticles([]);
                    setMeta(null);
                    setFeatured([]);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query, category, page]);

    // Sorotan hanya di halaman pertama.
    const highlighted = (page === 1 ? featured : []).map((article, index) => ({
        article,
        badge:
            index === 0
                ? t('articles.badgeNewest')
                : t('articles.badgeTopLiked'),
    }));
    const total = (meta?.total ?? articles.length) + featured.length;
    const isEmpty = !hasFilters && total === 0;

    function changeQuery(value: string) {
        setQuery(value);
        setPage(1);
    }

    function changeCategory(value: string) {
        setCategory(value);
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
                badge={t('articles.list.badge')}
                title={{
                    before: t('articles.list.heroBefore'),
                    accent: t('articles.list.heroAccent'),
                }}
                text={t('articles.list.heroText')}
                script={[
                    t('articles.list.scriptTop'),
                    t('articles.list.scriptBottom'),
                ]}
            />

            <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <section
                    ref={listRef}
                    aria-labelledby="artikel-title"
                    className="flex min-w-0 flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4">
                        <SectionTitle id="artikel-title">
                            {t('articles.list.all')}
                            {!isLoading && total > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/65">
                                    {t('articles.list.count', {
                                        count: total,
                                    })}
                                </span>
                            )}
                        </SectionTitle>

                        {!isEmpty && (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_16rem]">
                                <SearchField
                                    value={query}
                                    onChange={changeQuery}
                                    placeholder={t(
                                        'articles.list.searchPlaceholder'
                                    )}
                                    ariaLabel={t('articles.list.searchAria')}
                                    className="sm:col-span-2 xl:col-span-1"
                                />
                                <SelectField
                                    value={category}
                                    onChange={changeCategory}
                                    options={[
                                        {
                                            value: '',
                                            label: t(
                                                'articles.list.allCategories'
                                            ),
                                        },
                                        ...categories.map((name) => ({
                                            value: name,
                                            label: name,
                                        })),
                                    ]}
                                    ariaLabel={t('articles.list.categoryAria')}
                                    icon={<RiLayoutGridLine />}
                                    className="sm:col-span-2 xl:col-span-1"
                                />
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: SKELETON_COUNT }).map(
                                (_, index) => (
                                    <ArticleCardSkeleton key={index} />
                                )
                            )}
                        </div>
                    ) : isEmpty ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            {t('articles.empty')}
                        </p>
                    ) : hasFilters ? (
                        articles.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50 px-6 py-14 text-center">
                                <p className="text-sm text-oxford-navy-900/70">
                                    {t('articles.list.noMatch')}
                                </p>
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                                >
                                    <RiRestartLine
                                        aria-hidden
                                        className="size-4"
                                    />
                                    {t('articles.list.reset')}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {articles.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                        />
                                    ))}
                                </div>
                                <Pagination
                                    meta={meta}
                                    onPageChange={changePage}
                                />
                            </>
                        )
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                {highlighted.map(({ article, badge }) => (
                                    <ArticleCard
                                        key={article.id}
                                        article={article}
                                        badge={badge}
                                    />
                                ))}
                            </div>

                            {articles.length > 0 && (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {articles.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                        />
                                    ))}
                                </div>
                            )}
                            <Pagination meta={meta} onPageChange={changePage} />
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
