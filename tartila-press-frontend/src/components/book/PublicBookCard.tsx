import { Link, useNavigate } from 'react-router-dom';
import Badge from '@/components/Badge';
import Button from '@/components/Button/Button';
import { useCart } from '@/context/useCart';
import type { BookSummary } from '@/data/book/bookApi';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function PublicBookCard({ book }: { book: BookSummary }) {
    const navigate = useNavigate();
    const { addToCart, isInCart } = useCart();

    return (
        <div
            className="
            flex flex-col gap-3 rounded-xl border border-forest-moss-400 overflow-hidden
            bg-oxford-navy-900 hover:-translate-y-1 duration-200
            "
        >
            <Link to={`/buku/${book.id}`} className="flex flex-col gap-3">
                <div className="relative h-56 w-full bg-oxford-navy-700">
                    {book.front_cover ? (
                        <img
                            src={book.front_cover}
                            alt={book.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/40 text-sm">
                            Tanpa Sampul
                        </div>
                    )}
                    {book.discount > 0 && (
                        <div className="absolute top-3 left-3">
                            <Badge variant="primary">
                                Diskon {book.discount}%
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1 px-4">
                    {(book.category || book.field_category) && (
                        <p className="text-forest-moss-300 text-xs">
                            {[book.category?.name, book.field_category?.name]
                                .filter(Boolean)
                                .join(' • ')}
                        </p>
                    )}
                    <h5 className="text-white font-semibold line-clamp-2">
                        {book.title}
                    </h5>
                    {book.authors_text && (
                        <p className="text-white/60 text-sm line-clamp-1">
                            {book.authors_text}
                        </p>
                    )}
                    {book.editor_name && (
                        <p className="text-white/50 text-xs line-clamp-1">
                            Editor: {book.editor_name}
                        </p>
                    )}

                    <div className="flex flex-row items-center gap-2 mt-1">
                        {book.discount > 0 && (
                            <span className="text-white/40 line-through text-sm">
                                {rupiahFormatter.format(Number(book.price))}
                            </span>
                        )}
                        <span className="text-forest-moss-300 font-semibold">
                            {rupiahFormatter.format(book.final_price)}
                        </span>
                    </div>

                    {book.reviews_avg_rating !== null && (
                        <p className="text-white/60 text-xs">
                            ★ {Number(book.reviews_avg_rating).toFixed(1)}
                        </p>
                    )}
                </div>
            </Link>

            <div className="flex flex-col gap-2 px-4 pb-4">
                <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                        navigate(`/dashboard/beli-buku/${book.id}`)
                    }
                >
                    Beli Sekarang
                </Button>
                <Button
                    variant="outline2"
                    className="w-full"
                    onClick={() => addToCart(book.id)}
                    disabled={isInCart(book.id)}
                >
                    {isInCart(book.id) ? 'Di Keranjang' : '+ Keranjang'}
                </Button>
            </div>
        </div>
    );
}
