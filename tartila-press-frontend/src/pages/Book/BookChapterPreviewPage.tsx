import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import * as bookApi from '@/data/book/bookApi';

type PublicProfileRef = {
    slug: string;
    pen_name: string | null;
    is_published: boolean;
};

type Chapter = {
    id: number;
    chapter_number: number;
    title: string;
    preview_url: string | null;
    manuscript: {
        id: number;
        user: {
            id: number;
            name: string;
            public_profile: PublicProfileRef | null;
        };
    };
};

type BookDetail = {
    id: number;
    title: string;
    chapters: Chapter[];
};

export default function BookChapterPreviewPage() {
    const { id, chapterId } = useParams<{ id: string; chapterId: string }>();

    const [book, setBook] = useState<BookDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        Promise.resolve()
            .then(() => bookApi.get(id ?? ''))
            .then((response) => setBook(response.data))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [id]);

    const chapter = book?.chapters.find(
        (item) => String(item.id) === chapterId
    );

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
        addTag('citation_author', chapter.manuscript.user.name);
        if (chapter.preview_url) {
            addTag('citation_pdf_url', chapter.preview_url);
        }

        return () => {
            tags.forEach((tag) => document.head.removeChild(tag));
        };
    }, [chapter]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900">Memuat...</p>
            </div>
        );
    }

    if (notFound || !book || !chapter) {
        return <ErrorPage />;
    }

    const profile = chapter.manuscript.user.public_profile;

    return (
        <div className="flex flex-col gap-6 my-10 max-w-3xl mx-auto">
            <div className="flex flex-col gap-2 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-8">
                <p className="text-forest-moss-300 text-sm">
                    {book.title} — Bab {chapter.chapter_number}
                </p>
                <h1 className="text-white text-3xl font-bold">
                    {chapter.title}
                </h1>
                <p className="text-white/70">
                    Oleh:{' '}
                    {profile?.is_published ? (
                        <Link
                            to={`/penulis/${profile.slug}`}
                            className="text-forest-moss-300 hover:text-forest-moss-200"
                        >
                            {profile.pen_name || chapter.manuscript.user.name}
                        </Link>
                    ) : (
                        chapter.manuscript.user.name
                    )}
                </p>
            </div>

            <div className="bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-4">
                {chapter.preview_url ? (
                    <iframe
                        src={chapter.preview_url}
                        title={chapter.title}
                        className="w-full h-[70vh] rounded-lg bg-white"
                    />
                ) : (
                    <p className="text-white/60 text-sm text-center py-10">
                        Preview belum tersedia untuk bab ini.
                    </p>
                )}
            </div>

            <Link
                to={`/buku/${book.id}`}
                className="text-forest-moss-300 text-sm hover:text-forest-moss-200 self-center"
            >
                ← Kembali ke detail buku
            </Link>
        </div>
    );
}
