import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as articleApi from '@/data/article/articleApi';
import type { Article } from '@/data/article/articleApi';

const statusLabels: Record<string, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
};

const statusClasses: Record<string, string> = {
    pending: 'bg-porcelain-500/80 text-oxford-navy-900',
    approved: 'bg-forest-moss-500 text-oxford-navy-900',
    rejected: 'bg-red-500/80 text-oxford-navy-900',
};

export default function MyArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        articleApi
            .mine()
            .then((response) => setArticles(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-row items-center justify-between">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Artikel Saya
                </h5>
                <Link to="/dashboard/tulis-artikel">
                    <Button variant="secondary">+ Tulis Artikel</Button>
                </Link>
            </div>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : articles.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Anda belum menulis artikel.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-oxford-navy-900 font-semibold">
                                    {article.status === 'approved' ? (
                                        <Link
                                            to={`/artikel/${article.slug}`}
                                            className="hover:text-forest-moss-800"
                                        >
                                            {article.title}
                                        </Link>
                                    ) : (
                                        article.title
                                    )}
                                </p>
                                {article.field_category && (
                                    <p className="text-oxford-navy-900/55 text-xs">
                                        {article.field_category.name}
                                    </p>
                                )}
                            </div>
                            <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${statusClasses[article.status]}`}
                            >
                                {statusLabels[article.status]}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
