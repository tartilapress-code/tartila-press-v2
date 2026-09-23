import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import * as orderApi from '@/data/order/orderApi';
import * as paymentMethodApi from '@/data/paymentMethod/paymentMethodApi';
import Button from '@/components/Button/Button';
import { getOrderCategory } from '@/lib/orderCategory';
import { SHIPPING_STAGE_LABELS } from '@/lib/shippingStatus';
import { ApiError } from '@/lib/http';

type OrderItem = {
    id: number;
    name: string;
    subtotal: string;
    itemable_type: string;
};

type BookShipment = {
    id: number;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    status: string;
    estimated_arrival_date: string | null;
};

type OrderRecord = {
    id: number;
    order_number: string;
    status: string;
    subtotal: string;
    discount_total: string;
    editor_fee: string;
    total: string;
    created_at: string;
    editor: { id: number; name: string } | null;
    items: OrderItem[];
    manuscript: { id: number } | null;
    book_shipment: BookShipment | null;
    payment_proof_url: string | null;
    payment_verification_note: string | null;
};

type PaymentMethod = {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder_name: string;
};

function PaymentSection({
    order,
    paymentMethods,
    onUploaded,
}: {
    order: OrderRecord;
    paymentMethods: PaymentMethod[];
    onUploaded: () => void;
}) {
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file) {
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            await orderApi.uploadPaymentProof(order.id, formData);
            onUploaded();
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal mengunggah bukti transfer.'
            );
        } finally {
            setIsUploading(false);
        }
    }

    if (order.status === 'cancelled' && order.payment_verification_note) {
        return (
            <div className="flex flex-col gap-1 bg-oxford-navy-900/40 rounded-lg p-3">
                <p className="text-red-400 text-sm font-semibold">
                    Bukti transfer ditolak
                </p>
                <p className="text-white/70 text-sm">
                    {order.payment_verification_note}
                </p>
            </div>
        );
    }

    if (order.status !== 'pending') {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 bg-oxford-navy-900/40 rounded-lg p-3">
            {paymentMethods.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="text-white font-semibold text-sm">
                        Transfer ke salah satu rekening berikut:
                    </p>
                    {paymentMethods.map((method) => (
                        <p key={method.id} className="text-white/80 text-sm">
                            {method.bank_name} — {method.account_number} a.n.{' '}
                            {method.account_holder_name}
                        </p>
                    ))}
                </div>
            )}

            {order.payment_proof_url ? (
                <p className="text-forest-moss-300 text-sm">
                    Bukti transfer terkirim, menunggu verifikasi admin.{' '}
                    <a
                        href={order.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                    >
                        Lihat bukti
                    </a>
                </p>
            ) : (
                <p className="text-white/70 text-xs">
                    Setelah transfer, unggah bukti transfer di bawah ini.
                </p>
            )}

            <div className="flex flex-row items-center gap-3">
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="text-white text-xs"
                />
                {isUploading && (
                    <span className="text-white/60 text-xs">
                        Mengunggah...
                    </span>
                )}
            </div>
            {order.payment_proof_url && (
                <p className="text-white/50 text-xs">
                    Pilih file lagi untuk mengganti bukti transfer.
                </p>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
}

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
});

const statusLabels: Record<string, string> = {
    pending: 'Menunggu Verifikasi',
    confirmed: 'Dikonfirmasi',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
};

export default function MyOrdersPage() {
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    function loadOrders() {
        orderApi
            .mine()
            .then((response) => setOrders(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadOrders();
        paymentMethodApi
            .list()
            .then((response) => setPaymentMethods(response.data))
            .catch(() => setPaymentMethods([]));
    }, []);

    async function handleConfirmReceived(orderId: number) {
        setConfirmingId(orderId);
        setErrorMessage('');

        try {
            await orderApi.confirmReceived(orderId);
            loadOrders();
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setConfirmingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">Pesanan Saya</h5>

            {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : orders.length === 0 ? (
                <p className="text-white/70 text-sm">Belum ada pesanan.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            className="flex flex-col gap-2 bg-oxford-navy-900/40 rounded-lg p-4"
                        >
                            <div className="flex flex-row items-center justify-between">
                                <p className="text-white font-semibold">
                                    {order.order_number}
                                </p>
                                <span className="text-forest-moss-300 text-sm">
                                    {statusLabels[order.status] ??
                                        order.status}
                                </span>
                            </div>
                            <ul className="text-white/80 text-sm">
                                {order.items.map((item) => (
                                    <li key={item.id}>
                                        {item.name} —{' '}
                                        {rupiahFormatter.format(
                                            Number(item.subtotal)
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {order.editor && (
                                <p className="text-white/70 text-sm">
                                    Editor: {order.editor.name} (+
                                    {rupiahFormatter.format(
                                        Number(order.editor_fee)
                                    )}
                                    )
                                </p>
                            )}
                            <p className="text-white font-semibold">
                                Total: {rupiahFormatter.format(
                                    Number(order.total)
                                )}
                            </p>

                            <PaymentSection
                                order={order}
                                paymentMethods={paymentMethods}
                                onUploaded={loadOrders}
                            />

                            {order.book_shipment && (
                                <div className="flex flex-col gap-1 bg-oxford-navy-900/40 rounded-lg p-3">
                                    <p className="text-white/80 text-sm">
                                        Dikirim ke:{' '}
                                        {order.book_shipment.recipient_name},{' '}
                                        {
                                            order.book_shipment
                                                .recipient_address
                                        }{' '}
                                        ({order.book_shipment.recipient_phone}
                                        )
                                    </p>
                                    <p className="text-forest-moss-300 text-sm font-semibold">
                                        Status:{' '}
                                        {SHIPPING_STAGE_LABELS[
                                            order.book_shipment.status
                                        ] ?? order.book_shipment.status}
                                    </p>
                                    {order.book_shipment
                                        .estimated_arrival_date && (
                                        <p className="text-white/70 text-sm">
                                            Estimasi sampai:{' '}
                                            {dateFormatter.format(
                                                new Date(
                                                    order.book_shipment.estimated_arrival_date
                                                )
                                            )}
                                        </p>
                                    )}
                                    {order.book_shipment.status ===
                                        'awaiting_confirmation' && (
                                        <div className="flex flex-col gap-2 mt-1">
                                            <p className="text-white/70 text-xs">
                                                Kalau tidak dikonfirmasi
                                                dalam 2 hari, pesanan akan
                                                otomatis dianggap sudah
                                                sampai.
                                            </p>
                                            <Button
                                                variant="primary"
                                                className="self-start"
                                                onClick={() =>
                                                    handleConfirmReceived(
                                                        order.id
                                                    )
                                                }
                                                disabled={
                                                    confirmingId === order.id
                                                }
                                            >
                                                {confirmingId === order.id
                                                    ? 'Memproses...'
                                                    : 'Konfirmasi Buku Sudah Sampai'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.status === 'confirmed' &&
                                getOrderCategory(
                                    order.items[0]?.itemable_type
                                ) !== 'book' &&
                                (order.manuscript ? (
                                    <Link
                                        to={`/dashboard/naskah/${order.manuscript.id}`}
                                    >
                                        <Button
                                            variant="outline2"
                                            className="self-start"
                                        >
                                            Lihat Naskah
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link
                                        to={`/dashboard/submit-naskah/${order.id}`}
                                    >
                                        <Button
                                            variant="primary"
                                            className="self-start"
                                        >
                                            Submit Naskah
                                        </Button>
                                    </Link>
                                ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
