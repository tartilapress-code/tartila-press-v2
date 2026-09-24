import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RiBookOpenLine, RiRestartLine, RiSearchLine } from '@remixicon/react';
import * as bookApi from '@/data/book/bookApi';
import type { BookCategoryItem, BookSummary } from '@/data/book/bookApi';
import { CornerBlob } from '@/components/book/catalog/CatalogArt';
import CatalogBookCard, {
    CatalogBookCardSkeleton,
} from '@/components/book/catalog/CatalogBookCard';
import CatalogFilterBar, {
    type CatalogFilters,
} from '@/components/book/catalog/CatalogFilterBar';
import CatalogHero from '@/components/book/catalog/CatalogHero';
import CartFab from '@/components/cart/CartFab';
import FloatingContact from '@/components/FloatingContact';
import { CATALOG_SEARCH_PARAM } from '@/lib/catalogSearch';

const sortOptions = [
    { value: 'newest', label: 'Terbaru' },
    { value: 'price_asc', label: 'Harga Terendah' },
    { value: 'price_desc', label: 'Harga Tertinggi' },
    { value: 'rating', label: 'Rating Tertinggi' },
];

const defaultFilters: CatalogFilters = {
    search: '',
    bookCategoryId: '',
    fieldCategoryId: '',
    sort: 'newest',
};

const toOptions = (categories: BookCategoryItem[]) =>
    categories.map((category) => ({
        value: String(category.id),
        label: category.name,
    }));

const SKELETON_COUNT = 8;

// Kata kunci awal berasal dari kolom cari di navbar (/buku?cari=...).
function BookCatalog({ initialSearch }: { initialSearch: string }) {
    const [books, setBooks] = useState<BookSummary[]>([]);
    const [bookCategories, setBookCategories] = useState<BookCategoryItem[]>(
        []
    );
    const [fieldCategories, setFieldCategories] = useState<BookCategoryItem[]>(
        []
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filters, setFilters] = useState<CatalogFilters>({
        ...defaultFilters,
        search: initialSearch,
    });

    const hasActiveFilters =
        filters.search !== '' ||
        filters.bookCategoryId !== '' ||
        filters.fieldCategoryId !== '' ||
        filters.sort !== defaultFilters.sort;

    useEffect(() => {
        Promise.all([
            bookApi.listBookCategories(),
            bookApi.listFieldCategories(),
        ])
            .then(([bookCategoryRes, fieldCategoryRes]) => {
                setBookCategories(bookCategoryRes.data);
                setFieldCategories(fieldCategoryRes.data);
            })
            .catch(() => {
                setBookCategories([]);
                setFieldCategories([]);
            });
    }, []);

    useEffect(() => {
        let cancelled = false;

        const timeout = setTimeout(() => {
            setIsLoading(true);

            bookApi
                .list({
                    search: filters.search || undefined,
                    book_category_id: filters.bookCategoryId || undefined,
                    field_category_id: filters.fieldCategoryId || undefined,
                    sort: filters.sort as bookApi.BookListParams['sort'],
                })
                .then((response) => {
                    if (!cancelled) setBooks(response.data);
                })
                .catch(() => {
                    if (!cancelled) setBooks([]);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [filters]);

    return (
        <>
            <CartFab />
            <FloatingContact />

            {/* Keluar dari margin <main> supaya hero selebar halaman. */}
            <div className="-mx-10 -my-2 overflow-x-clip">
                <CatalogHero />

                <div className="relative px-4 pb-20 pt-6 sm:px-8 lg:px-10">
                    <CatalogFilterBar
                        filters={filters}
                        onChange={(patch) =>
                            setFilters((previous) => ({
                                ...previous,
                                ...patch,
                            }))
                        }
                        bookCategories={toOptions(bookCategories)}
                        fieldCategories={toOptions(fieldCategories)}
                        sortOptions={sortOptions}
                    />

                    <section
                        aria-label="Daftar buku"
                        aria-busy={isLoading}
                        className="relative mt-8 xl:grid xl:grid-cols-[9rem_minmax(0,1fr)] xl:gap-8"
                    >
                        <CornerBlob className="pointer-events-none absolute -left-24 top-[26rem] hidden h-[260px] w-auto xl:block" />

                        <aside className="relative hidden xl:block">
                            <div className="sticky top-28 flex flex-col gap-4 pt-16">
                                <RiBookOpenLine
                                    aria-hidden
                                    className="size-11 text-forest-moss-600"
                                />
                                <p className="font-display text-[1.4rem] font-medium leading-snug text-oxford-navy-700">
                                    Baca Hari Ini, Tumbuh Esok.
                                </p>
                                <span className="h-0.5 w-12 rounded bg-forest-moss-500" />
                            </div>
                        </aside>

                        <div className="relative">
                            {isLoading ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                                    {Array.from({ length: SKELETON_COUNT }).map(
                                        (_, index) => (
                                            <CatalogBookCardSkeleton
                                                key={index}
                                            />
                                        )
                                    )}
                                </div>
                            ) : books.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 rounded-2xl bg-forest-moss-50 px-6 py-16 text-center">
                                    <span className="flex size-14 items-center justify-center rounded-full bg-forest-moss-100 text-forest-moss-700">
                                        <RiSearchLine
                                            aria-hidden
                                            className="size-7"
                                        />
                                    </span>
                                    <p className="font-display text-lg font-semibold text-oxford-navy-700">
                                        Buku belum ditemukan
                                    </p>
                                    <p className="max-w-sm text-sm text-oxford-navy-900/65">
                                        Belum ada buku yang cocok dengan
                                        pencarian ini. Coba kata kunci atau
                                        kategori lain.
                                    </p>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFilters(defaultFilters)
                                            }
                                            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2.5 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                                        >
                                            <RiRestartLine
                                                aria-hidden
                                                className="size-4"
                                            />
                                            Reset Filter
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                                    {books.map((book) => (
                                        <CatalogBookCard
                                            key={book.id}
                                            book={book}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

export default function BookCatalogPage() {
    const [params] = useSearchParams();
    const search = params.get(CATALOG_SEARCH_PARAM) ?? '';

    // key: pencarian baru dari navbar memuat ulang katalog dengan kata kunci itu.
    return <BookCatalog key={search} initialSearch={search} />;
}
