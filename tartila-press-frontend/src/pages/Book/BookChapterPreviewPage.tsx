import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RiArrowLeftLine, RiFileTextLine } from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import * as bookApi from '@/data/book/bookApi';
import type { BookDetail } from '@/data/book/bookApi';
import { HeroHill, HeroLeafRight } from '@/components/art/HeroArt';
import PersonLink from '@/components/book/detail/PersonLink';
import PillBadge from '@/components/ui/PillBadge';

function PreviewSkeleton() {
    return (
        <div className="-mx-10 -my-2 animate-pulse" aria-hidden>
            <div className="bg-forest-moss-50/60">
                <div className="mx-auto flex max-w-[1232px] flex-col gap-3 px-6 py-10 sm:px-10 lg:pl-16">
                    <div className="h-4 w-40 rounded bg-oxford-navy-100/60" />
                    <div className="h-7 w-24 rounded-full bg-oxford-navy-100/60" />
                    <div className="h-10 w-72 rounded bg-oxford-navy-100/60" />
                </div>
            </div>
            <div className="mx-auto max-w-[1232px] px-4 py-8 sm:px-8 lg:px-10">
                <div className="h-[60vh] rounded-2xl bg-oxford-navy-100/40" />
            </div>
        </div>
    );
}

export default function BookChapterPreviewPage() {
    const { t } = useTranslation();
    const { id, chapterId } = useParams<{ id: string; chapterId: string }>();

    const [book, setBook] = useState<BookDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setNotFound(false);

                return bookApi.get(id ?? '');
            })
            .then((response) => {
                if (!cancelled) setBook(response.data);
            })
            .catch((error) => {
                if (cancelled) return;

                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    const chapter = book?.chapters.find(
        (item) => String(item.id) === chapterId
    );

    // Meta tag Google Scholar (citation_*) untuk bab yang sedang dibuka.
    useEffect(() => {
        if (!chapter) {
            return;
        }

        const tags: HTMLMetaElement[] = [];

        function addTag(name: string, content: string) {
            const tag = document.createElement('meta');
            tag.name = name;
            tag.content = content;
            document.head.appendChild(tag);
            tags.push(tag);
        }

        addTag('citation_title', chapter.title);
        if (chapter.manuscript) {
            addTag('citation_author', chapter.manuscript.user.name);
        }
        if (chapter.preview_url) {
            addTag('citation_pdf_url', chapter.preview_url);
        }

        return () => {
            tags.forEach((tag) => document.head.removeChild(tag));
        };
    }, [chapter]);

    if (isLoading) {
        return <PreviewSkeleton />;
    }

    if (notFound || !book || !chapter) {
        return <ErrorPage />;
    }

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <section className="relative isolate overflow-hidden bg-white">
                <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
                <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[20%] sm:block" />

                <div className="relative mx-auto flex max-w-[1232px] flex-col gap-3 px-6 py-8 sm:px-10 sm:py-10 lg:pl-16 lg:pr-[24%]">
                    <Link
                        to={`/buku/${book.slug}`}
                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                    >
                        <RiArrowLeftLine aria-hidden className="size-4" />
                        {t('books.detail.chapterPreview.back')}
                    </Link>

                    <div className="flex flex-wrap gap-2">
                        <PillBadge
                            label={t('books.detail.chapterPreview.badge', {
                                number: chapter.chapter_number,
                            })}
                            withIcon
                        />
                    </div>

                    <h1 className="font-display break-words text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl xl:text-5xl">
                        {chapter.title}
                    </h1>

                    {chapter.manuscript && (
                        <p className="text-base text-oxford-navy-900/70">
                            {t('books.detail.hero.by')}{' '}
                            <PersonLink person={chapter.manuscript.user} />
                        </p>
                    )}
                    <p className="text-sm text-oxford-navy-900/55">
                        {t('books.detail.chapterPreview.partOf')}{' '}
                        <Link
                            to={`/buku/${book.slug}`}
                            className="font-medium text-oxford-navy-700 hover:underline"
                        >
                            {book.title}
                        </Link>
                    </p>
                </div>
            </section>

            <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <div className="rounded-2xl border border-forest-moss-100 bg-white p-3 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-5">
                    {chapter.preview_url ? (
                        <iframe
                            src={chapter.preview_url}
                            title={chapter.title}
                            className="h-[70vh] w-full rounded-lg bg-forest-moss-50"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <RiFileTextLine
                                aria-hidden
                                className="size-10 text-forest-moss-300"
                            />
                            <p className="text-sm text-oxford-navy-900/60">
                                {t('books.detail.chapterPreview.noPreview')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
