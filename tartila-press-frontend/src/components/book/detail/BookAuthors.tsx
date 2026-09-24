import PersonLink from '@/components/book/detail/PersonLink';
import type { BookSummary } from '@/data/book/bookApi';

/**
 * Daftar penulis buku dipisah koma: tiap nama menautkan ke profil publiknya
 * bila ada, dan memakai teks penulis bebas untuk buku tanpa profil terhubung.
 */
export default function BookAuthors({
    book,
}: {
    book: Pick<BookSummary, 'author_profiles' | 'authors_text'>;
}) {
    if (book.author_profiles.length > 0) {
        return (
            <>
                {book.author_profiles.map((author, index) => (
                    <span key={index}>
                        {index > 0 && ', '}
                        <PersonLink person={author} />
                    </span>
                ))}
            </>
        );
    }

    return <>{book.authors_text}</>;
}
