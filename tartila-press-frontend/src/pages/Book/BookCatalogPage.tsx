import { useEffect, useState } from 'react';
import * as bookApi from '@/data/book/bookApi';
import type { BookCategoryItem, BookSummary } from '@/data/book/bookApi';
import PublicBookCard from '@/components/book/PublicBookCard';
import Select from '@/components/Select/Select';
import CartFab from '@/components/cart/CartFab';

const sortOptions = [
    { value: 'newest', label: 'Terbaru' },
    { value: 'price_asc', label: 'Harga Terendah' },
    { value: 'price_desc', label: 'Harga Tertinggi' },
    { value: 'rating', label: 'Rating Tertinggi' },
];

export default function BookCatalogPage() {
    const [books, setBooks] = useState<BookSummary[]>([]);
    const [bookCategories, setBookCategories] = useState<BookCategoryItem[]>(
        []
    );
    const [fieldCategories, setFieldCategories] = useState<
        BookCategoryItem[]
    >([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [search, setSearch] = useState<string>('');
    const [bookCategoryId, setBookCategoryId] = useState<string>('');
    const [fieldCategoryId, setFieldCategoryId] = useState<string>('');
    const [sort, setSort] = useState<string>('newest');

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
                    search: search || undefined,
                    book_category_id: bookCategoryId || undefined,
                    field_category_id: fieldCategoryId || undefined,
                    sort: sort as bookApi.BookListParams['sort'],
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
    }, [search, bookCategoryId, fieldCategoryId, sort]);

    return (
        <div className="flex flex-col gap-6 my-10">
            <CartFab />
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-oxford-navy-900 text-3xl font-bold">
                    Katalog Buku
                </h1>
                <p className="text-oxford-navy-900/70">
                    Jelajahi buku-buku terbitan Tartila Press.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 bg-oxford-navy-900 rounded-xl p-4">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari judul atau penulis..."
                    className="flex-1 p-3 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white outline-none"
                />
                <div className="w-full md:w-56">
                    <Select
                        name="book_category"
                        label="Kategori Buku"
                        option_data={[
                            { value: '', label: 'Semua Kategori Buku' },
                            ...bookCategories.map((category) => ({
                                value: String(category.id),
                                label: category.name,
                            })),
                        ]}
                        value={bookCategoryId}
                        onChange={(e) => setBookCategoryId(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-56">
                    <Select
                        name="field_category"
                        label="Kategori Keilmuan"
                        option_data={[
                            { value: '', label: 'Semua Kategori Keilmuan' },
                            ...fieldCategories.map((category) => ({
                                value: String(category.id),
                                label: category.name,
                            })),
                        ]}
                        value={fieldCategoryId}
                        onChange={(e) => setFieldCategoryId(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select
                        name="sort"
                        label="Urutkan"
                        option_data={sortOptions}
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <p className="text-oxford-navy-900 text-center">Memuat...</p>
            ) : books.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-center">
                    Belum ada buku yang cocok dengan pencarian ini.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {books.map((book) => (
                        <PublicBookCard key={book.id} book={book} />
                    ))}
                </div>
            )}
        </div>
    );
}
