import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ShippingAddressFields, {
    type ShippingAddressValue,
} from '@/components/order/ShippingAddressFields';
import { useCart } from '@/context/useCart';
import * as bookApi from '@/data/book/bookApi';
import * as orderApi from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

type CartBook = {
    id: number;
    title: string;
    front_cover: string | null;
    price: string;
    discount: number;
    final_price: number;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function CartPage() {
    const navigate = useNavigate();
    const { bookIds, removeFromCart, clearCart } = useCart();

    const [books, setBooks] = useState<CartBook[]>([]);
    const [shipping, setShipping] = useState<ShippingAddressValue>({
        recipient_name: '',
        recipient_phone: '',
        recipient_address: '',
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        let cancelled = false;

        Promise.all(
            bookIds.map((id) =>
                bookApi.get(id).then(
                    (response) => response.data as CartBook,
                    () => null
                )
            )
        )
            .then((results) => {
                if (!cancelled) {
                    setBooks(
                        results.filter(
                            (book): book is CartBook => book !== null
                        )
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [bookIds]);

    const total = books.reduce((sum, book) => sum + book.final_price, 0);

    async function handleCheckout() {
        if (books.length === 0) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            await orderApi.create({
                type: 'book',
                book_ids: books.map((book) => book.id),
                recipient_name: shipping.recipient_name || undefined,
                recipient_phone: shipping.recipient_phone || undefined,
                recipient_address: shipping.recipient_address || undefined,
            });
            clearCart();
            navigate('/dashboard/pesanan');
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 max-w-xl">
            <h5 className="text-white text-xl font-semibold">
                Keranjang Buku
            </h5>

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : books.length === 0 ? (
                <div className="flex flex-col gap-3">
                    <p className="text-white/70 text-sm">
                        Keranjang Anda masih kosong.
                    </p>
                    <Link to="/buku" className="self-start">
                        <Button variant="outline2">Jelajahi Katalog Buku</Button>
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3">
                        {books.map((book) => (
                            <div
                                key={book.id}
                                className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-3"
                            >
                                <div className="flex flex-row items-center gap-3">
                                    {book.front_cover && (
                                        <img
                                            src={book.front_cover}
                                            alt={book.title}
                                            className="w-10 h-14 object-cover rounded"
                                        />
                                    )}
                                    <div>
                                        <p className="text-white font-semibold">
                                            {book.title}
                                        </p>
                                        <p className="text-forest-moss-300 text-sm">
                                            {rupiahFormatter.format(
                                                book.final_price
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFromCart(book.id)}
                                    className="text-red-400 text-sm hover:text-red-300"
                                >
                                    Hapus
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-white/20 pt-4">
                        <p className="text-white text-lg font-semibold">
                            Total: {rupiahFormatter.format(total)}
                        </p>
                    </div>

                    <ShippingAddressFields
                        value={shipping}
                        onChange={setShipping}
                    />

                    {errorMessage && (
                        <p className="text-red-400 text-sm">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleCheckout}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? 'Memproses...'
                            : `Checkout Semua (${books.length})`}
                    </Button>
                </>
            )}
        </div>
    );
}
