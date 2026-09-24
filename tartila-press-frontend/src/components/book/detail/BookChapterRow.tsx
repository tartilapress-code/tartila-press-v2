import { Link } from 'react-router-dom';
import { RiFileTextLine } from '@remixicon/react';
import PersonLink from '@/components/book/detail/PersonLink';
import type { BookChapterEntry } from '@/data/book/bookApi';

/**
 * Satu baris bab pada buku kompilasi Book Chapter: nomor, judul (menuju
 * halaman preview bab), penulis bab, dan tombol "Baca Preview".
 */
export default function BookChapterRow({
    bookSlug,
    chapter,
}: {
    bookSlug: string;
    chapter: BookChapterEntry;
}) {
    const previewPath = `/buku/${bookSlug}/bab/${chapter.id}`;
    // Bab yang belum terhubung ke naskah tidak punya penulis.
    const author = chapter.manuscript?.user ?? null;

    return (
        <li className="flex flex-col gap-3 rounded-xl border border-forest-moss-100 bg-white p-4 transition-colors hover:border-forest-moss-300 sm:flex-row sm:items-center sm:gap-4">
            <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-moss-100 font-display text-lg font-bold text-forest-moss-800"
            >
                {chapter.chapter_number}
            </span>

            <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-snug text-oxford-navy-700">
                    <Link
                        to={previewPath}
                        className="hover:text-forest-moss-700 hover:underline"
                    >
                        <span className="sr-only">
                            Bab {chapter.chapter_number}:{' '}
                        </span>
                        {chapter.title}
                    </Link>
                </h3>
                {author && (
                    <p className="mt-1 text-sm text-oxford-navy-900/65">
                        Oleh <PersonLink person={author} />
                    </p>
                )}
            </div>

            {chapter.preview_url ? (
                <Link
                    to={previewPath}
                    aria-label={`Baca preview bab ${chapter.chapter_number}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-oxford-navy-700 px-4 py-2.5 text-sm font-semibold text-oxford-navy-700 transition-colors hover:bg-oxford-navy-700 hover:text-white"
                >
                    <RiFileTextLine aria-hidden className="size-[18px]" />
                    Baca Preview
                </Link>
            ) : (
                <span className="shrink-0 text-xs text-oxford-navy-900/45">
                    Preview belum tersedia
                </span>
            )}
        </li>
    );
}
