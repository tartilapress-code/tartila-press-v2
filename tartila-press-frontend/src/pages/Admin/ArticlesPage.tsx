import { useEffect, useState } from 'react';
import * as articleApi from '@/data/article/articleApi';
import type { Article } from '@/data/article/articleApi';
import Button from '@/components/Button/Button';
import { ApiError } from '@/lib/http';

export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [processingId, setProcessingId] = useState<number | null>(null);

    useEffect(() => {
        articleApi
            .adminList('pending')
            .then((response) => setArticles(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    async function handleApprove(id: number) {
        setProcessingId(id);
        setErrorMessage('');

        try {
            await articleApi.adminApprove(id);
            setArticles((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReject(id: number) {
        setProcessingId(id);
        setErrorMessage('');

        try {
            await articleApi.adminReject(id);
            setArticles((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Artikel Menunggu Persetujuan
            </h5>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : articles.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Tidak ada artikel yang menunggu.
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
                                    {article.title}
                                </p>
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Oleh {article.user.name}
                                    {article.field_category &&
                                        ` — ${article.field_category.name}`}
                                </p>
                            </div>
                            <div className="flex flex-row gap-2 shrink-0">
                                <Button
                                    variant="primary"
                                    onClick={() => handleApprove(article.id)}
                                    disabled={processingId === article.id}
                                >
                                    Setujui
                                </Button>
                                <Button
                                    variant="outline2"
                                    onClick={() => handleReject(article.id)}
                                    disabled={processingId === article.id}
                                >
                                    Tolak
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
