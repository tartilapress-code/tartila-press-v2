import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ShippingAddressFields, {
    type ShippingAddressValue,
} from '@/components/order/ShippingAddressFields';
import * as bookApi from '@/data/book/bookApi';
import * as orderApi from '@/data/order/orderApi';
import VoucherField from '@/components/voucher/VoucherField';
import { useVoucher } from '@/components/voucher/useVoucher';
import { ApiError } from '@/lib/http';
import PaymentMethodPicker from '@/components/order/PaymentMethodPicker';
import { usePaymentMethodChoice } from '@/hooks/usePaymentMethodChoice';

type BookSummary = {
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

export default function BuyBookPage() {
    const { bookSlug } = useParams<{ bookSlug: string }>();
    const navigate = useNavigate();
    const paymentChoice = usePaymentMethodChoice();

    const [book, setBook] = useState<BookSummary | null>(null);
    const [shipping, setShipping] = useState<ShippingAddressValue>({
        recipient_name: '',
        recipient_phone: '',
        recipient_address: '',
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        bookApi
            .get(bookSlug ?? '')
            .then((response) => setBook(response.data))
            .finally(() => setIsLoading(false));
    }, [bookSlug]);

    const voucher = useVoucher(
        book ? { type: 'book', book_ids: [book.id] } : null
    );

    async function handleSubmit() {
        if (!book) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await orderApi.create({
                payment_method_id: paymentChoice.selectedId ?? undefined,
                type: 'book',
                book_ids: [book.id],
                voucher_code: voucher.code,
                recipient_name: shipping.recipient_name || undefined,
                recipient_phone: shipping.recipient_phone || undefined,
                recipient_address: shipping.recipient_address || undefined,
            });
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

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!book) {
        return <p className="text-oxford-navy-900">Buku tidak ditemukan.</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Beli Buku: {book.title}
            </h5>

            <div className="flex flex-row items-center gap-3">
                {book.discount > 0 && (
                    <span className="text-oxford-navy-900/55 line-through">
                        {rupiahFormatter.format(Number(book.price))}
                    </span>
                )}
                <span className="text-forest-moss-700 text-xl font-semibold">
                    {rupiahFormatter.format(book.final_price)}
                </span>
            </div>

            <VoucherField voucher={voucher} />
            <PaymentMethodPicker choice={paymentChoice} />

            {voucher.quote && (
                <p className="text-oxford-navy-900 text-lg font-semibold">
                    Total:{' '}
                    {rupiahFormatter.format(
                        Math.max(
                            0,
                            book.final_price - voucher.quote.voucher_discount
                        )
                    )}
                </p>
            )}

            <ShippingAddressFields value={shipping} onChange={setShipping} />

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSubmitting || paymentChoice.isMissing}
            >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Beli Buku'}
            </Button>
        </div>
    );
}
