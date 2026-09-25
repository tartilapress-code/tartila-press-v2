import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiLayoutGridLine, RiRestartLine } from '@remixicon/react';
import ArticleCard from '@/components/article/ArticleCard';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import SectionTitle from '@/components/ui/SectionTitle';
import * as articleApi from '@/data/article/articleApi';
import type { Article } from '@/data/article/articleApi';

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

    useEffect(() => {
        articleApi
            .list()
            .then((response) => setArticles(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    const categories = [
        ...new Set(
            articles
                .map((article) => article.field_category?.name)
                .filter((name): name is string => Boolean(name))
        ),
    ].sort((a, b) => a.localeCompare(b, 'id'));

    const needle = query.trim().toLocaleLowerCase('id');
    const hasFilters = needle !== '' || category !== '';
    const matched = articles.filter((article) => {
        const inCategory =
            category === '' || article.field_category?.name === category;
        const author =
            article.user.public_profile?.pen_name || article.user.name;
        const inText =
            needle === '' ||
            article.title.toLocaleLowerCase('id').includes(needle) ||
            author.toLocaleLowerCase('id').includes(needle);

        return inCategory && inText;
    });

    // Tanpa filter: artikel terbaru dan yang paling disukai disorot di atas.
    const newest = articles[0];
    const mostLiked = articles
        .filter((article) => article.id !== newest?.id)
        .reduce<Article | null>((best, article) => {
            if (!best || article.likes_count > best.likes_count) {
                return article;
            }
            return best;
        }, null);

    const highlighted: { article: Article; badge: string }[] = [];
    if (newest) {
        highlighted.push({ article: newest, badge: t('articles.badgeNewest') });
    }
    if (mostLiked) {
        highlighted.push({
            article: mostLiked,
            badge: t('articles.badgeTopLiked'),
        });
    }

    const highlightedIds = new Set(highlighted.map((item) => item.article.id));
    const rest = articles.filter((article) => !highlightedIds.has(article.id));

    function resetFilters() {
        setQuery('');
        setCategory('');
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
                    aria-labelledby="artikel-title"
                    className="flex min-w-0 flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4">
                        <SectionTitle id="artikel-title">
                            {t('articles.list.all')}
                            {!isLoading && articles.length > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/65">
                                    {t('articles.list.count', {
                                        count: hasFilters
                                            ? matched.length
                                            : articles.length,
                                    })}
                                </span>
                            )}
                        </SectionTitle>

                        {articles.length > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_16rem]">
                                <SearchField
                                    value={query}
                                    onChange={setQuery}
                                    placeholder={t(
                                        'articles.list.searchPlaceholder'
                                    )}
                                    ariaLabel={t('articles.list.searchAria')}
                                    className="sm:col-span-2 xl:col-span-1"
                                />
                                <SelectField
                                    value={category}
                                    onChange={setCategory}
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
                    ) : articles.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            {t('articles.empty')}
                        </p>
                    ) : hasFilters ? (
                        matched.length === 0 ? (
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
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {matched.map((article) => (
                                    <ArticleCard
                                        key={article.id}
                                        article={article}
                                    />
                                ))}
                            </div>
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

                            {rest.length > 0 && (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {rest.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
