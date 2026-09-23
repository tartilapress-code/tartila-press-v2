import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bookApi from '@/data/book/bookApi';
import type { BookSummary } from '@/data/book/bookApi';
import PublicBookCard from '@/components/book/PublicBookCard';
import Button from '@/components/Button/Button';

export default function BookCatalogHome() {
    const [books, setBooks] = useState<BookSummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        bookApi
            .list()
            .then((response) => setBooks(response.data.slice(0, 4)))
            .catch(() => setBooks([]))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return <p className="text-oxford-navy-900 text-center">Memuat...</p>;
    }

    if (books.length === 0) {
        return (
            <p className="text-oxford-navy-900/70 text-center">
                Belum ada buku yang ditampilkan.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {books.map((book) => (
                    <PublicBookCard key={book.id} book={book} />
                ))}
            </div>
            <Link to="/buku" className="self-center">
                <Button variant="secondary">Lihat Semua Buku</Button>
            </Link>
        </div>
    );
}
