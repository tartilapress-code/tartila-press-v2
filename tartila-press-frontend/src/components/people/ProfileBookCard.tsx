import { Link } from 'react-router-dom';
import BookCover from '@/components/book/catalog/BookCover';
import type { ProfileBook } from '@/components/book/BookGrid';
import { DEFAULT_CHAPTER_COVER } from '@/lib/bookChapterPublic';

type Named = { name: string } | null;

export type ProfileBookDetail = ProfileBook & {
    category?: Named;
    field_category?: Named;
    created_at?: string | null;
    citation_publication_date?: string | null;
    // Buku hasil gabungan bab: sampul kosong memakai sampul bawaan Book Chapter.
    is_chapter_compilation?: boolean;
};

// Tahun terbit: tanggal sitasi bila ada, kalau tidak tahun buku dibuat.
function bookYear(book: ProfileBookDetail): string | null {
    const source = book.citation_publication_date || book.created_at;
    const match = source ? String(source).match(/\d{4}/) : null;

    return match ? match[0] : null;
}

/** Kartu buku kecil di profil: sampul A5, judul, kategori, dan tahun. */
export default function ProfileBookCard({ book }: { book: ProfileBookDetail }) {
    // Jenis buku (Novel, Buku Ajar, ...); bidang keilmuan sebagai cadangan.
    const kind = book.category?.name || book.field_category?.name;
    const year = bookYear(book);

    return (
        <Link
            to={`/buku/${book.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-forest-moss-100 bg-white p-3.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_rgba(1,26,44,0.32)]"
        >
            <BookCover
                src={book.front_cover}
                fallbackSrc={
                    book.is_chapter_compilation
                        ? DEFAULT_CHAPTER_COVER
                        : undefined
                }
                title={book.title}
                alt=""
                className="w-20 shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-1">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-oxford-navy-700 transition-colors group-hover:text-oxford-navy-500">
                    {book.title}
                </h3>
                {kind && (
                    <p className="line-clamp-1 text-sm text-oxford-navy-900/55">
                        {kind}
                    </p>
                )}
                {year && (
                    <p className="text-sm text-oxford-navy-900/55">{year}</p>
                )}
            </div>
        </Link>
    );
}
