import { Link } from 'react-router-dom';

export type ProfileBook = {
    id: number;
    slug: string;
    title: string;
    front_cover: string | null;
    final_price: number;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function BookGrid({ books }: { books: ProfileBook[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {books.map((book) => (
                <Link
                    key={book.id}
                    to={`/buku/${book.slug}`}
                    className="flex flex-col gap-2 group"
                >
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100">
                        {book.front_cover ? (
                            <img
                                src={book.front_cover}
                                alt={book.title}
                                className="w-full h-full object-cover group-hover:opacity-80"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-oxford-navy-900/45">
                                Tanpa Sampul
                            </div>
                        )}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-oxford-navy-900">
                        {book.title}
                    </p>
                    <p className="text-sm text-forest-moss-700">
                        {rupiahFormatter.format(book.final_price)}
                    </p>
                </Link>
            ))}
        </div>
    );
}
