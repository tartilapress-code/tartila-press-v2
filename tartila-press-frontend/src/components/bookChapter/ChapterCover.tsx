import BookCover from '@/components/book/catalog/BookCover';
import { DEFAULT_CHAPTER_COVER } from '@/lib/bookChapterPublic';

/**
 * Sampul proyek Book Chapter: memakai sampul yang diunggah, dan sampul bawaan
 * (`DEFAULT_CHAPTER_COVER`) bila kosong atau gagal dimuat.
 */
export default function ChapterCover({
    src,
    title,
    alt,
    className,
}: {
    src: string | null;
    title: string;
    alt?: string;
    className?: string;
}) {
    return (
        <BookCover
            src={src}
            fallbackSrc={DEFAULT_CHAPTER_COVER}
            title={title}
            alt={alt}
            className={className}
        />
    );
}
