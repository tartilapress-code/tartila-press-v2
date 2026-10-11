import { Link } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import PillBadge from '@/components/ui/PillBadge';
import type { ReaderBook } from '@/data/readerApi';

/** Label akses di kartu/detail berdasarkan hak baca pengguna (bila login). */
function accessBadge(book: ReaderBook): { text: string; tone: string } | null {
    const reason = book.me?.access?.reason;

    if (reason === 'author')
        return {
            text: 'Buku Anda',
            tone: 'bg-oxford-navy-50 text-oxford-navy-800',
        };
    if (reason === 'subscription')
        return {
            text: 'Langganan aktif',
            tone: 'bg-forest-moss-100 text-forest-moss-800',
        };
    if (reason === 'purchase')
        return {
            text: 'Sudah dibeli',
            tone: 'bg-forest-moss-100 text-forest-moss-800',
        };
    if (book.free_now)
        return { text: 'Baca gratis', tone: 'bg-amber-100 text-amber-900' };

    return null;
}

/** Kartu buku untuk katalog, beranda, dan rak. */
export default function BookCard({ book }: { book: ReaderBook }) {
    const badge = accessBadge(book);
    const topic =
        book.pustaka === 'fiksi'
            ? (book.genre ?? book.category)
            : (book.education_field ?? book.category);

    return (
        <Link
            to={`/buku/${book.id}`}
            className="group card-shadow flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-forest-moss-100 transition hover:-translate-y-1 hover:ring-forest-moss-300"
        >
            <div className="relative">
                <BookCover
                    src={book.book.cover}
                    title={book.book.title}
                    alt=""
                    className="w-full"
                />
                {badge && (
                    <span
                        className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${badge.tone}`}
                    >
                        {badge.text}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
                <h3 className="font-display line-clamp-2 text-base font-bold leading-snug text-oxford-navy-700 group-hover:text-oxford-navy-600">
                    {book.book.title}
                </h3>
                <p className="line-clamp-1 text-sm text-oxford-navy-900/65">
                    {book.book.authors}
                </p>

                <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <PillBadge label={book.pustaka_label} />
                    {topic && <PillBadge label={topic} />}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-oxford-navy-900/65">
                    <span
                        className="inline-flex items-center gap-1"
                        title="Disukai"
                    >
                        <i aria-hidden className="ri-heart-3-line" />
                        {book.likes_count}
                    </span>
                    <span
                        className="inline-flex items-center gap-1"
                        title="Jumlah pembaca terbanyak pada satu halaman"
                    >
                        <i aria-hidden className="ri-eye-line" />
                        {book.top_page_readers} pembaca
                    </span>
                    <span
                        className="inline-flex items-center gap-1"
                        title="Jumlah halaman"
                    >
                        <i aria-hidden className="ri-file-text-line" />
                        {book.page_count} hlm
                    </span>
                </div>
            </div>
        </Link>
    );
}
