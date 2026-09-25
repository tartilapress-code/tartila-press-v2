import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    RiArrowLeftLine,
    RiBarcodeLine,
    RiCalendarLine,
    RiCheckLine,
    RiFilePdf2Line,
    RiGraduationCapLine,
    RiShoppingCartLine,
    RiTranslate2,
    RiUserLine,
} from '@remixicon/react';
import {
    BookStackLine,
    HeroHill,
    HeroLeafRight,
} from '@/components/art/HeroArt';
import BookAuthors from '@/components/book/detail/BookAuthors';
import BookCoverStage from '@/components/book/detail/BookCoverStage';
import { useContentLanguages } from '@/components/language/useContentLanguages';
import PersonLink from '@/components/book/detail/PersonLink';
import PillBadge from '@/components/ui/PillBadge';
import StarRating from '@/components/ui/StarRating';
import { previewPdfUrl, type BookDetail } from '@/data/book/bookApi';
import { useFormat } from '@/i18n/useFormat';
import { DEFAULT_CHAPTER_COVER } from '@/lib/bookChapterPublic';
import { toContentLanguages } from '@/lib/contentLanguages';
import {
    averageRating,
    bookCategoryNames,
    hasAuthors,
    isHttpUrl,
} from '@/lib/bookDetail';

type MetaItem = { key: string; icon: ReactNode; content: ReactNode };

const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors';
const primaryButton = `${buttonBase} bg-oxford-navy-700 text-white hover:cursor-pointer hover:bg-oxford-navy-600`;
const tonalButton = `${buttonBase} bg-forest-moss-100 text-forest-moss-800 hover:cursor-pointer hover:bg-forest-moss-200 disabled:cursor-default disabled:bg-forest-moss-50 disabled:text-forest-moss-800/70`;
const chipLink =
    'inline-flex items-center gap-1.5 rounded-lg border border-forest-moss-200 bg-white/70 px-3 py-2 text-sm font-medium text-forest-moss-800 transition-colors hover:bg-forest-moss-100';

/**
 * Hero detail buku: sampul besar yang interaktif (`BookCoverStage`: membesar
 * saat di-hover, dan digeser menjadi flipbook dari PDF preview; sampul bawaan
 * Book Chapter untuk buku kompilasi tanpa sampul), lencana kategori, judul
 * serif, penulis, editor/ISBN/tanggal terbit, harga, ringkasan ulasan, tombol
 * beli & keranjang, serta tautan preview.
 */
export default function BookDetailHero({
    book,
    inCart,
    onBuy,
    onAddToCart,
    onSeeReviews,
}: {
    book: BookDetail;
    inCart: boolean;
    onBuy: () => void;
    onAddToCart: () => void;
    onSeeReviews: () => void;
}) {
    const { t } = useTranslation();
    const { dateLong, rupiah } = useFormat();
    const { metaLine } = useContentLanguages();
    const languages = toContentLanguages(book.languages);
    const rating = averageRating(book);
    const published = book.citation_publication_date
        ? dateLong(book.citation_publication_date)
        : null;
    // Kolom di admin bisa berisi teks asal-asalan; hanya alamat http(s) yang
    // sah yang dijadikan tautan.
    const scholarUrl = isHttpUrl(book.google_scholar_url)
        ? book.google_scholar_url
        : null;
    const badges = [
        ...(book.is_chapter_compilation
            ? [t('books.detail.hero.chapterBadge')]
            : []),
        ...bookCategoryNames(book),
    ];

    const meta: MetaItem[] = [];

    if (book.editor_profile) {
        meta.push({
            key: 'editor',
            icon: <RiUserLine />,
            content: (
                <>
                    {t('books.detail.hero.editorLabel')}{' '}
                    <PersonLink person={book.editor_profile} role="editor" />
                </>
            ),
        });
    }
    if (book.isbn) {
        meta.push({
            key: 'isbn',
            icon: <RiBarcodeLine />,
            content: t('books.detail.hero.isbn', { isbn: book.isbn }),
        });
    }
    if (published) {
        meta.push({
            key: 'published',
            icon: <RiCalendarLine />,
            content: t('books.detail.hero.publishedOn', { date: published }),
        });
    }
    if (languages.length > 0) {
        meta.push({
            key: 'languages',
            icon: <RiTranslate2 />,
            content: metaLine(languages),
        });
    }

    return (
        <section className="relative isolate overflow-hidden bg-white">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[20%] sm:block" />

            <div className="relative mx-auto flex max-w-[1232px] flex-col items-center gap-6 px-6 py-8 text-center sm:flex-row sm:gap-8 sm:px-10 sm:py-10 sm:text-left lg:pl-16 lg:pr-[24%]">
                <BookCoverStage
                    title={book.title}
                    frontCover={book.front_cover}
                    fallbackCover={
                        book.is_chapter_compilation
                            ? DEFAULT_CHAPTER_COVER
                            : undefined
                    }
                    backCover={book.back_cover}
                    discount={book.discount}
                    previewApiUrl={
                        book.preview_url ? previewPdfUrl(book.slug) : null
                    }
                    previewFileUrl={book.preview_url}
                />

                <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start">
                    <Link
                        to="/buku"
                        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                    >
                        <RiArrowLeftLine aria-hidden className="size-4" />
                        {t('books.detail.hero.back')}
                    </Link>

                    {badges.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                            {badges.map((label, index) => (
                                <PillBadge
                                    key={label}
                                    label={label}
                                    withIcon={index === 0}
                                />
                            ))}
                        </div>
                    )}

                    <h1 className="font-display break-words text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl xl:text-5xl">
                        {book.title}
                    </h1>

                    {hasAuthors(book) && (
                        <p className="text-base text-oxford-navy-900/70">
                            {t('books.detail.hero.by')}{' '}
                            <BookAuthors book={book} />
                        </p>
                    )}

                    {meta.length > 0 && (
                        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-oxford-navy-900/70 sm:justify-start">
                            {meta.map((item) => (
                                <li
                                    key={item.key}
                                    className="inline-flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="text-oxford-navy-700 [&>svg]:size-[18px]"
                                    >
                                        {item.icon}
                                    </span>
                                    <span>{item.content}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-1 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:justify-start">
                        <div>
                            <p className="text-xs text-oxford-navy-900/55">
                                {t('books.detail.hero.price')}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start">
                                {book.discount > 0 && (
                                    <span className="text-sm text-oxford-navy-900/45 line-through">
                                        {rupiah(Number(book.price))}
                                    </span>
                                )}
                                <span className="text-3xl font-bold text-oxford-navy-700">
                                    {rupiah(book.final_price)}
                                </span>
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onSeeReviews}
                            className="flex flex-col items-center gap-1 text-left hover:cursor-pointer sm:items-start"
                        >
                            {rating !== null ? (
                                <>
                                    <span className="flex items-center gap-2">
                                        <StarRating
                                            value={rating}
                                            starClassName="size-5"
                                        />
                                        <span className="text-lg font-bold text-oxford-navy-700">
                                            {rating.toFixed(1)}
                                        </span>
                                    </span>
                                    <span className="text-xs text-oxford-navy-900/55 underline-offset-2 hover:underline">
                                        {t('books.detail.reviewsCount', {
                                            count: book.reviews.length,
                                        })}
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-oxford-navy-900/55 underline-offset-2 hover:underline">
                                    {t('books.detail.hero.noReviews')}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tombol selebar penuh di mobile, berjajar mulai sm */}
                    <div className="mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                        <button
                            type="button"
                            onClick={onBuy}
                            className={primaryButton}
                        >
                            {t('books.detail.hero.buy')}
                        </button>
                        <button
                            type="button"
                            onClick={onAddToCart}
                            disabled={inCart}
                            className={tonalButton}
                        >
                            {inCart ? (
                                <>
                                    <RiCheckLine
                                        aria-hidden
                                        className="size-[18px]"
                                    />
                                    {t('books.detail.hero.inCart')}
                                </>
                            ) : (
                                <>
                                    <RiShoppingCartLine
                                        aria-hidden
                                        className="size-[18px]"
                                    />
                                    {t('books.detail.hero.addToCart')}
                                </>
                            )}
                        </button>
                    </div>

                    {(book.preview_url || scholarUrl) && (
                        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                            {book.preview_url && (
                                <a
                                    href={book.preview_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={chipLink}
                                >
                                    <RiFilePdf2Line
                                        aria-hidden
                                        className="size-[18px]"
                                    />
                                    {t('books.detail.hero.previewPdf')}
                                </a>
                            )}
                            {scholarUrl && (
                                <a
                                    href={scholarUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={chipLink}
                                >
                                    <RiGraduationCapLine
                                        aria-hidden
                                        className="size-[18px]"
                                    />
                                    {t('books.detail.hero.scholar')}
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <BookStackLine className="pointer-events-none absolute bottom-0 right-[6%] hidden h-[215px] w-auto lg:block" />
        </section>
    );
}
