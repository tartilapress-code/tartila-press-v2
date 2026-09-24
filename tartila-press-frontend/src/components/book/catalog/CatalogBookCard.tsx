import { Link } from 'react-router-dom';
import { RiCheckLine, RiShoppingCartLine, RiStarFill } from '@remixicon/react';
import BookCover from '@/components/book/catalog/BookCover';
import { useCart } from '@/context/useCart';
import { DEFAULT_CHAPTER_COVER } from '@/lib/bookChapterPublic';
import type { BookSummary, ProfileLinkable } from '@/data/book/bookApi';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function ProfileNameLink({
    person,
    role = 'penulis',
}: {
    person: ProfileLinkable;
    role?: 'penulis' | 'editor';
}) {
    if (person.public_profile?.is_published) {
        return (
            <Link
                to={`/${role}/${person.public_profile.slug}`}
                className="hover:text-forest-moss-700 hover:underline"
            >
                {person.public_profile.pen_name || person.name}
            </Link>
        );
    }

    return <span>{person.name}</span>;
}

function Authors({ book }: { book: BookSummary }) {
    if (book.author_profiles.length > 0) {
        return (
            <p className="line-clamp-1 text-[13px] text-oxford-navy-900/70">
                {book.author_profiles.map((author, index) => (
                    <span key={index}>
                        {index > 0 && ', '}
                        <ProfileNameLink person={author} />
                    </span>
                ))}
            </p>
        );
    }

    return book.authors_text ? (
        <p className="line-clamp-1 text-[13px] text-oxford-navy-900/70">
            {book.authors_text}
        </p>
    ) : null;
}

/**
 * Kartu buku untuk katalog: sampul A5 di atas panggung lembut, kategori,
 * judul, penulis, harga, dan tombol keranjang.
 */
export default function CatalogBookCard({ book }: { book: BookSummary }) {
    const { addToCart, isInCart } = useCart();
    const inCart = isInCart(book.id);
    const categories = [book.category?.name, book.field_category?.name].filter(
        (name): name is string => Boolean(name)
    );

    return (
        <article className="group @container relative flex h-full flex-col rounded-2xl bg-white p-3 shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] ring-1 ring-oxford-navy-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-14px_rgba(1,26,44,0.34)] sm:p-4">
            {book.discount > 0 && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-forest-moss-600 px-2.5 py-1 text-[11px] font-semibold leading-none text-white shadow-sm sm:right-4 sm:top-4 sm:text-xs">
                    Diskon {book.discount}%
                </span>
            )}

            <Link to={`/buku/${book.slug}`} className="flex flex-col gap-3">
                <div className="flex justify-center rounded-xl bg-linear-to-b from-oxford-navy-50/80 via-white to-white px-3 pb-5 pt-9">
                    <BookCover
                        src={book.front_cover}
                        fallbackSrc={
                            book.is_chapter_compilation
                                ? DEFAULT_CHAPTER_COVER
                                : undefined
                        }
                        title={book.title}
                        alt=""
                        className="w-[72%] transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                </div>

                {/* Tinggi baris kategori dijaga agar judul antar kartu sejajar */}
                <div className="flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
                    {categories.map((name) => (
                        <span
                            key={name}
                            className="max-w-full truncate rounded-full bg-forest-moss-100 px-2.5 py-1 text-[11px] font-medium leading-none text-forest-moss-800"
                        >
                            {name}
                        </span>
                    ))}
                </div>

                <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug text-oxford-navy-900 transition-colors group-hover:text-oxford-navy-600">
                    {book.title}
                </h3>
            </Link>

            <div className="mt-2 flex flex-1 flex-col gap-1">
                <div className="flex flex-row items-center justify-between gap-2">
                    <Authors book={book} />
                    {book.reviews_avg_rating !== null && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-oxford-navy-900/70">
                            <RiStarFill
                                className="size-3.5 text-amber-400"
                                aria-hidden
                            />
                            {Number(book.reviews_avg_rating).toFixed(1)}
                        </span>
                    )}
                </div>

                {book.editor_profile && (
                    <p className="line-clamp-1 text-xs text-oxford-navy-900/50">
                        Editor:{' '}
                        <ProfileNameLink
                            person={book.editor_profile}
                            role="editor"
                        />
                    </p>
                )}

                <div className="mt-auto flex flex-col gap-3 pt-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {book.discount > 0 && (
                            <span className="text-xs text-oxford-navy-900/45 line-through sm:text-sm">
                                {rupiahFormatter.format(Number(book.price))}
                            </span>
                        )}
                        <span className="text-base font-bold text-oxford-navy-700 sm:text-lg">
                            {rupiahFormatter.format(book.final_price)}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => addToCart(book.id)}
                        disabled={inCart}
                        className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-oxford-navy-700 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:cursor-pointer hover:bg-oxford-navy-600 disabled:cursor-default disabled:bg-forest-moss-100 disabled:text-forest-moss-800 sm:text-sm"
                    >
                        {inCart ? (
                            <>
                                <RiCheckLine className="size-4" aria-hidden />
                                Di Keranjang
                            </>
                        ) : (
                            <>
                                <RiShoppingCartLine
                                    className="size-4"
                                    aria-hidden
                                />
                                <span className="@[11.5rem]:hidden">
                                    Keranjang
                                </span>
                                <span className="hidden @[11.5rem]:inline">
                                    Tambah ke Keranjang
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </article>
    );
}

// Kerangka kartu saat data dimuat — bentuknya sama dengan kartu asli.
export function CatalogBookCardSkeleton() {
    return (
        <div
            aria-hidden
            className="flex h-full animate-pulse flex-col rounded-2xl bg-white p-3 ring-1 ring-oxford-navy-900/5 sm:p-4"
        >
            <div className="flex justify-center rounded-xl bg-oxford-navy-50/70 px-3 pb-5 pt-9">
                <div className="aspect-[148/210] w-[72%] rounded bg-oxford-navy-100/70" />
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
                <div className="h-5 w-24 rounded-full bg-oxford-navy-100/60" />
                <div className="h-4 w-full rounded bg-oxford-navy-100/60" />
                <div className="h-4 w-2/3 rounded bg-oxford-navy-100/60" />
                <div className="h-3 w-1/2 rounded bg-oxford-navy-100/60" />
                <div className="mt-2 h-5 w-1/2 rounded bg-oxford-navy-100/60" />
                <div className="h-10 w-full rounded-lg bg-oxford-navy-100/60" />
            </div>
        </div>
    );
}
