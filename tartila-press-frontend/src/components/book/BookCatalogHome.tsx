import { useEffect, useState } from 'react';
import * as bookApi from '@/data/book/bookApi';
import type { BookSummary } from '@/data/book/bookApi';
import CatalogBookCard, {
    CatalogBookCardSkeleton,
} from '@/components/book/catalog/CatalogBookCard';

const COUNT = 4;

/** Empat buku terbaru di beranda, memakai kartu yang sama dengan katalog. */
export default function BookCatalogHome() {
    const [books, setBooks] = useState<BookSummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        bookApi
            .list()
            .then((response) => setBooks(response.data.slice(0, COUNT)))
            .catch(() => setBooks([]))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                {Array.from({ length: COUNT }).map((_, index) => (
                    <CatalogBookCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (books.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                Belum ada buku yang ditampilkan.
            </p>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {books.map((book) => (
                <CatalogBookCard key={book.id} book={book} />
            ))}
        </div>
    );
}
