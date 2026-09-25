import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowLeftLine, RiHeartFill, RiHeartLine } from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import logo from '@/assets/logo/logo.png';
import Button from '@/components/Button/Button';
import PillBadge from '@/components/ui/PillBadge';
import SectionTitle from '@/components/ui/SectionTitle';
import * as articleApi from '@/data/article/articleApi';
import type { Article, ArticleComment } from '@/data/article/articleApi';
import { useFormat } from '@/i18n/useFormat';

export default function ArticleDetailPage() {
    const { t } = useTranslation();
    const { dateLong } = useFormat();
    const { slug } = useParams<{ slug: string }>();
    const { user, isAuthenticated } = useAuth();

    const [article, setArticle] = useState<Article | null>(null);
    const [comments, setComments] = useState<ArticleComment[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);
    const [isLiking, setIsLiking] = useState<boolean>(false);

    const [commentBody, setCommentBody] = useState<string>('');
    const [isSubmittingComment, setIsSubmittingComment] =
        useState<boolean>(false);

    function load() {
        return articleApi
            .get(slug ?? '')
            .then((response) => {
                setArticle(response.data);
                setComments(response.data.comments ?? []);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function handleToggleLike() {
        if (!article || isLiking) {
            return;
        }

        setIsLiking(true);
        try {
            const response = article.liked_by_me
                ? await articleApi.unlike(article.slug)
                : await articleApi.like(article.slug);

            setArticle((prev) =>
                prev
                    ? {
                          ...prev,
                          likes_count: response.data.likes_count,
                          liked_by_me: response.data.liked_by_me,
                      }
                    : prev
            );
        } finally {
            setIsLiking(false);
        }
    }

    async function handleCommentSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!article || !commentBody.trim()) {
            return;
        }

        setIsSubmittingComment(true);
        try {
            await articleApi.createComment(article.slug, commentBody.trim());
            setCommentBody('');
            const response = await articleApi.listComments(article.slug);
            setComments(response.data);
        } finally {
            setIsSubmittingComment(false);
        }
    }

    async function handleDeleteComment(commentId: number) {
        if (!article) {
            return;
        }

        await articleApi.deleteComment(article.slug, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
    }

    if (isLoading) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <p className="text-oxford-navy-900/70">{t('common.loading')}</p>
            </div>
        );
    }

    if (notFound || !article) {
        return <ErrorPage />;
    }

    const authorName =
        article.user.public_profile?.pen_name || article.user.name;
    const authorPhoto = article.user.public_profile?.profile_photo;
    const authorSlug = article.user.public_profile?.is_published
        ? article.user.public_profile.slug
        : null;
    const authorCity = article.user.public_profile?.city;

    return (
        // Keluar dari margin <main> supaya latar selebar halaman.
        <div className="-mx-10 -my-2 bg-white">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-20 pt-6 sm:px-6">
                <Link
                    to="/artikel"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                >
                    <RiArrowLeftLine aria-hidden className="size-4" />
                    {t('articles.detail.back')}
                </Link>

                {article.photo && (
                    <img
                        src={article.photo}
                        alt={article.title}
                        className="max-h-96 w-full rounded-2xl object-cover shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)]"
                    />
                )}

                <div className="flex flex-col gap-4">
                    {article.field_category && (
                        <PillBadge label={article.field_category.name} />
                    )}
                    <h1 className="font-display text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl">
                        {article.title}
                    </h1>
                    <div className="flex flex-row flex-wrap items-center gap-3 text-sm text-oxford-navy-900/65">
                        <img
                            src={authorPhoto || logo}
                            alt=""
                            className="size-10 shrink-0 rounded-full bg-forest-moss-50 object-cover ring-1 ring-forest-moss-100"
                        />
                        {authorSlug ? (
                            <Link
                                to={`/penulis/${authorSlug}`}
                                className="font-semibold text-oxford-navy-700 hover:underline"
                            >
                                {authorName}
                            </Link>
                        ) : (
                            <span className="font-semibold text-oxford-navy-900">
                                {authorName}
                            </span>
                        )}
                        {authorCity && <span>· {authorCity}</span>}
                        {article.published_at && (
                            <span>· {dateLong(article.published_at)}</span>
                        )}
                    </div>
                </div>

                <div className="whitespace-pre-line text-lg leading-relaxed text-oxford-navy-900/85">
                    {article.body}
                </div>

                <div className="flex flex-row flex-wrap items-center gap-3 border-t border-forest-moss-100 pt-6">
                    <Button
                        variant={article.liked_by_me ? 'secondary' : 'outline'}
                        className="inline-flex items-center gap-2"
                        onClick={handleToggleLike}
                        disabled={isLiking || !isAuthenticated}
                    >
                        {article.liked_by_me ? (
                            <RiHeartFill aria-hidden className="size-5" />
                        ) : (
                            <RiHeartLine aria-hidden className="size-5" />
                        )}
                        {article.liked_by_me
                            ? t('articles.detail.liked')
                            : t('articles.detail.like')}{' '}
                        ({article.likes_count})
                    </Button>
                    {!isAuthenticated && (
                        <p className="text-sm text-oxford-navy-900/65">
                            {t('articles.detail.loginToLike')}
                        </p>
                    )}
                </div>

                <section
                    aria-labelledby="komentar-title"
                    className="flex flex-col gap-4 rounded-2xl border border-forest-moss-100 bg-forest-moss-50/60 p-5 sm:p-6"
                >
                    <SectionTitle id="komentar-title">
                        {t('articles.detail.comments')}
                    </SectionTitle>

                    {comments.length === 0 ? (
                        <p className="text-sm text-oxford-navy-900/65">
                            {t('articles.detail.noComments')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {comments.map((comment) => (
                                <div
                                    key={comment.id}
                                    className="flex flex-row items-start justify-between gap-4 rounded-xl border border-forest-moss-100 bg-white p-4"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-oxford-navy-900">
                                            {comment.user.name}
                                        </p>
                                        <p className="mt-0.5 text-sm text-oxford-navy-900/75">
                                            {comment.body}
                                        </p>
                                    </div>
                                    {user?.id === comment.user.id && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDeleteComment(comment.id)
                                            }
                                            className="shrink-0 text-sm text-red-700 hover:cursor-pointer hover:text-red-600"
                                        >
                                            {t('articles.detail.delete')}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {isAuthenticated ? (
                        <form
                            onSubmit={handleCommentSubmit}
                            className="flex flex-col gap-3 border-t border-forest-moss-100 pt-4"
                        >
                            <textarea
                                value={commentBody}
                                onChange={(e) => setCommentBody(e.target.value)}
                                placeholder={t(
                                    'articles.detail.commentPlaceholder'
                                )}
                                rows={3}
                                className="w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/40 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30"
                            />
                            <Button
                                type="submit"
                                variant="primary"
                                className="self-start"
                                disabled={
                                    isSubmittingComment || !commentBody.trim()
                                }
                            >
                                {isSubmittingComment
                                    ? t('articles.detail.sending')
                                    : t('articles.detail.send')}
                            </Button>
                        </form>
                    ) : (
                        <p className="border-t border-forest-moss-100 pt-4 text-sm text-oxford-navy-900/65">
                            {t('articles.detail.loginToComment')}
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
