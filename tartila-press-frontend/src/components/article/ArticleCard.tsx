import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowRightLine, RiArticleLine, RiHeartLine } from '@remixicon/react';
import logo from '@/assets/logo/logo.png';
import type { Article } from '@/data/article/articleApi';
import { useFormat } from '@/i18n/useFormat';

function excerptOf(body: string, maxLength = 160): string {
    const plain = body.replace(/\s+/g, ' ').trim();
    return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}

/**
 * Kartu artikel (tema terang): foto dengan kategori, jumlah suka, judul serif,
 * cuplikan, penulis, dan tanda "Baca". `badge` menandai artikel unggulan
 * (mis. "Terbaru").
 */
export default function ArticleCard({
    article,
    badge,
}: {
    article: Article;
    badge?: string;
}) {
    const { t } = useTranslation();
    const { dateLong } = useFormat();
    const authorName =
        article.user.public_profile?.pen_name || article.user.name;
    const authorPhoto = article.user.public_profile?.profile_photo;

    return (
        <Link
            to={`/artikel/${article.slug}`}
            className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-forest-moss-100 bg-white shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-14px_rgba(1,26,44,0.34)]"
        >
            <div className="relative h-44 w-full overflow-hidden bg-forest-moss-50">
                {article.photo ? (
                    <img
                        src={article.photo}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-forest-moss-50 to-forest-moss-100 text-forest-moss-500">
                        <RiArticleLine aria-hidden className="size-12" />
                    </div>
                )}

                {article.field_category && (
                    <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-forest-moss-800 shadow-sm">
                        {article.field_category.name}
                    </span>
                )}
                {badge && (
                    <span className="absolute right-3 top-3 rounded-full bg-forest-moss-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        {badge}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
                <p className="flex items-center gap-1.5 text-xs text-oxford-navy-900/55">
                    <RiHeartLine
                        aria-hidden
                        className="size-4 text-forest-moss-600"
                    />
                    {t('articles.likes', { count: article.likes_count })}
                </p>
                <h3 className="font-display line-clamp-2 text-lg font-bold leading-snug text-oxford-navy-700 transition-colors group-hover:text-oxford-navy-600">
                    {article.title}
                </h3>
                <p className="line-clamp-3 text-sm leading-relaxed text-oxford-navy-900/70">
                    {excerptOf(article.body)}
                </p>

                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <img
                            src={authorPhoto || logo}
                            alt=""
                            className="size-9 shrink-0 rounded-full bg-forest-moss-50 object-cover ring-1 ring-forest-moss-100"
                        />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-oxford-navy-900">
                                {authorName}
                            </p>
                            <p className="text-xs text-oxford-navy-900/55">
                                {article.published_at
                                    ? dateLong(article.published_at)
                                    : ''}
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-oxford-navy-700">
                        {t('articles.read')}
                        <RiArrowRightLine
                            aria-hidden
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                        />
                    </span>
                </div>
            </div>
        </Link>
    );
}
