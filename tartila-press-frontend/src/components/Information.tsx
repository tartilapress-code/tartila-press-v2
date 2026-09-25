import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArticleCard from '@/components/article/ArticleCard';
import * as articleApi from '@/data/article/articleApi';
import type { Article } from '@/data/article/articleApi';

const COUNT = 3;

/** Artikel terbaru di beranda. */
export default function Information() {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        articleApi
            .list()
            .then((response) => setArticles(response.data.slice(0, COUNT)))
            .catch(() => setArticles([]))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div
                aria-hidden
                className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
                {Array.from({ length: COUNT }).map((_, index) => (
                    <div
                        key={index}
                        className="h-[24rem] animate-pulse rounded-2xl border border-forest-moss-100 bg-white"
                    />
                ))}
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                {t('articles.empty')}
            </p>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
            ))}
        </div>
    );
}
