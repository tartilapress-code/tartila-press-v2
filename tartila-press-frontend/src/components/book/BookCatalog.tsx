import books from '@/data/book/dummy-book.json';
import BookCard from './BookCard';

interface BookCatalogProps {
    selectedCategory?: string;
    search?: string;
}

export default function BookCatalog({
    selectedCategory = 'All',
    search,
}: BookCatalogProps): React.ReactNode {
    // const dynamicRegex: RegExp = new RegExp(`\\b${search}\\b`, 'i');
    const dynamicRegex: RegExp = new RegExp(`\\b${search}\\b`, 'i');
    console.log(search);

    if (selectedCategory === 'All') {
        return (
            <section>
                <div
                    className="
                    lg:grid-cols-2
                    md:grid-cols-1
                    grid grid-cols-1 auto-rows-fr gap-6 gap-y-15
                    "
                >
                    {books
                        .filter(
                            (book) =>
                                dynamicRegex.test(book.judul_buku) ||
                                dynamicRegex.test(book.penulis)
                        )
                        .map((book) => {
                            return <BookCard book={book} />;
                        })}
                </div>
            </section>
        );
    }
    if (selectedCategory !== 'All') {
        return (
            <>
                <section>
                    <div
                        className="
                        lg:grid-cols-2
                        md:grid-cols-1
                        grid grid-cols-1 auto-rows-fr gap-6 gap-y-15
                        "
                    >
                        {books
                            .filter(
                                (book) =>
                                    dynamicRegex.test(book.penulis) &&
                                    book.kategori === selectedCategory
                                // dynamicRegex.test(book.judul_buku)
                            )
                            .map((book) => {
                                return <BookCard book={book} />;
                            })}
                    </div>
                </section>
            </>
        );
    }
    if (selectedCategory !== 'All') {
        return (
            <>
                <section>
                    <div
                        className="
                        lg:grid-cols-2
                        md:grid-cols-1
                        grid grid-cols-1 auto-rows-fr gap-6 gap-y-15
                        "
                    >
                        {books
                            .filter(
                                (book) =>
                                    dynamicRegex.test(book.judul_buku) &&
                                    book.kategori === selectedCategory
                            )
                            .map((book) => {
                                return <BookCard book={book} />;
                            })}
                    </div>
                </section>
            </>
        );
    }
}
