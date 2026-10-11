import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ShippingAddressFields, {
    type ShippingAddressValue,
} from '@/components/order/ShippingAddressFields';
import { useCart } from '@/context/useCart';
import * as bookApi from '@/data/book/bookApi';
import * as orderApi from '@/data/order/orderApi';
import VoucherField from '@/components/voucher/VoucherField';
import { useVoucher } from '@/components/voucher/useVoucher';
import { ApiError } from '@/lib/http';
import PaymentMethodPicker from '@/components/order/PaymentMethodPicker';
import { usePaymentMethodChoice } from '@/hooks/usePaymentMethodChoice';

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
    const paymentChoice = usePaymentMethodChoice();
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

        Promise.resolve()
            .then(() =>
                bookIds.length === 0
                    ? { data: [] as CartBook[] }
                    : bookApi.list({
                          ids: bookIds.join(','),
                          per_page: Math.min(100, bookIds.length),
                      })
            )
            .then((response) => {
                if (!cancelled) {
                    setBooks(response.data as CartBook[]);
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

    const voucher = useVoucher(
        books.length > 0
            ? { type: 'book', book_ids: books.map((book) => book.id) }
            : null
    );

    const total = Math.max(
        0,
        books.reduce((sum, book) => sum + book.final_price, 0) -
            (voucher.quote?.voucher_discount ?? 0)
    );

    async function handleCheckout() {
        if (books.length === 0) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await orderApi.create({
                payment_method_id: paymentChoice.selectedId ?? undefined,
                type: 'book',
                book_ids: books.map((book) => book.id),
                voucher_code: voucher.code,
                recipient_name: shipping.recipient_name || undefined,
                recipient_phone: shipping.recipient_phone || undefined,
                recipient_address: shipping.recipient_address || undefined,
            });
            clearCart();
            navigate(`/dashboard/pesanan/${response.data.id}/invoice`);
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
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Keranjang Buku
            </h5>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : books.length === 0 ? (
                <div className="flex flex-col gap-3">
                    <p className="text-oxford-navy-900/70 text-sm">
                        Keranjang Anda masih kosong.
                    </p>
                    <Link to="/buku" className="self-start">
                        <Button variant="outline2">
                            Jelajahi Katalog Buku
                        </Button>
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3">
                        {books.map((book) => (
                            <div
                                key={book.id}
                                className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3"
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
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {book.title}
                                        </p>
                                        <p className="text-forest-moss-700 text-sm">
                                            {rupiahFormatter.format(
                                                book.final_price
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFromCart(book.id)}
                                    className="text-red-600 text-sm hover:text-red-700"
                                >
                                    Hapus
                                </button>
                            </div>
                        ))}
                    </div>

                    <VoucherField voucher={voucher} />
                    <PaymentMethodPicker choice={paymentChoice} />

                    <div className="flex flex-col gap-1 border-t border-forest-moss-200 pt-4">
                        {voucher.quote && (
                            <p className="text-forest-moss-700 text-sm">
                                Voucher ({voucher.quote.code}): −
                                {rupiahFormatter.format(
                                    voucher.quote.voucher_discount
                                )}
                            </p>
                        )}
                        <p className="text-oxford-navy-900 text-lg font-semibold">
                            Total: {rupiahFormatter.format(total)}
                        </p>
                    </div>

                    <ShippingAddressFields
                        value={shipping}
                        onChange={setShipping}
                    />

                    {errorMessage && (
                        <p className="text-red-600 text-sm">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleCheckout}
                        disabled={isSubmitting || paymentChoice.isMissing}
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
