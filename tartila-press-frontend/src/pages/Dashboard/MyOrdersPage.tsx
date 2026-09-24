import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import * as orderApi from '@/data/order/orderApi';
import * as paymentMethodApi from '@/data/paymentMethod/paymentMethodApi';
import Button from '@/components/Button/Button';
import OrderMessages from '@/components/order/OrderMessages';
import { getOrderCategory, type OrderCategory } from '@/lib/orderCategory';
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

type OrderStatusHistoryEntry = {
    id: number;
    event: string;
    note: string | null;
    created_at: string;
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
    status_histories: OrderStatusHistoryEntry[];
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
            <div className="flex flex-col gap-1 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
                <p className="text-red-600 text-sm font-semibold">
                    Bukti transfer ditolak
                </p>
                <p className="text-oxford-navy-900/70 text-sm">
                    {order.payment_verification_note}
                </p>
            </div>
        );
    }

    if (order.status !== 'pending') {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
            {paymentMethods.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="text-oxford-navy-900 font-semibold text-sm">
                        Transfer ke salah satu rekening berikut:
                    </p>
                    {paymentMethods.map((method) => (
                        <p key={method.id} className="text-oxford-navy-900/80 text-sm">
                            {method.bank_name} — {method.account_number} a.n.{' '}
                            {method.account_holder_name}
                        </p>
                    ))}
                </div>
            )}

            {order.payment_proof_url ? (
                <p className="text-forest-moss-700 text-sm">
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
                <p className="text-oxford-navy-900/70 text-xs">
                    Setelah transfer, unggah bukti transfer di bawah ini.
                </p>
            )}

            <div className="flex flex-row items-center gap-3">
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="text-oxford-navy-900 text-xs"
                />
                {isUploading && (
                    <span className="text-oxford-navy-900/65 text-xs">
                        Mengunggah...
                    </span>
                )}
            </div>
            {order.payment_proof_url && (
                <p className="text-oxford-navy-900/55 text-xs">
                    Pilih file lagi untuk mengganti bukti transfer.
                </p>
            )}

            {error && <p className="text-red-600 text-xs">{error}</p>}
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

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const statusLabels: Record<string, string> = {
    pending: 'Menunggu Verifikasi',
    confirmed: 'Dikonfirmasi',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
};

const ORDER_HISTORY_EVENT_LABELS: Record<string, string> = {
    order_placed: 'Pesanan dibuat',
    payment_proof_uploaded: 'Bukti transfer diunggah',
    payment_confirmed: 'Pembayaran dikonfirmasi admin',
    order_cancelled: 'Pesanan dibatalkan',
    order_completed: 'Pesanan selesai',
    shipment_pending: 'Pengiriman menunggu konfirmasi',
    shipment_confirmed: 'Pengiriman dikonfirmasi',
    shipment_printing: 'Proses cetak',
    shipment_packing: 'Proses packing',
    shipment_shipping: 'Proses pengiriman',
    shipment_awaiting_confirmation: 'Menunggu konfirmasi diterima',
    shipment_cancelled: 'Pengiriman dibatalkan',
};

const categoryTabs: { value: OrderCategory; label: string }[] = [
    { value: 'book', label: 'Pesanan Buku Fisik' },
    { value: 'package', label: 'Paket Penerbitan' },
    { value: 'book_chapter', label: 'Book Chapter' },
    { value: 'event', label: 'Event' },
];

export default function MyOrdersPage() {
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [activeCategory, setActiveCategory] =
        useState<OrderCategory>('book');
    const [expandedId, setExpandedId] = useState<number | null>(null);

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

    const grouped = useMemo(() => {
        const groups: Record<OrderCategory, OrderRecord[]> = {
            book: [],
            package: [],
            book_chapter: [],
            event: [],
        };

        orders.forEach((order) => {
            const category = getOrderCategory(order.items[0]?.itemable_type);
            if (category) {
                groups[category].push(order);
            }
        });

        return groups;
    }, [orders]);

    return (
        <div className="flex flex-col gap-4">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Pesanan Saya</h5>

            <div className="flex flex-row flex-wrap gap-2">
                {categoryTabs.map((tab) => (
                    <Button
                        key={tab.value}
                        variant={
                            activeCategory === tab.value
                                ? 'primary'
                                : 'outline2'
                        }
                        onClick={() => setActiveCategory(tab.value)}
                    >
                        {tab.label} ({grouped[tab.value].length})
                    </Button>
                ))}
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                {errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                )}

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : grouped[activeCategory].length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada pesanan.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {grouped[activeCategory].map((order) => (
                        <div
                            key={order.id}
                            className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div className="flex flex-row items-center justify-between">
                                <p className="text-oxford-navy-900 font-semibold">
                                    {order.order_number}
                                </p>
                                <span className="text-forest-moss-700 text-sm">
                                    {statusLabels[order.status] ??
                                        order.status}
                                </span>
                            </div>
                            <ul className="text-oxford-navy-900/80 text-sm">
                                {order.items.map((item) => (
                                    <li key={item.id}>
                                        {item.name} —{' '}
                                        {rupiahFormatter.format(
                                            Number(item.subtotal)
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {Number(order.discount_total) > 0 && (
                                <p className="text-forest-moss-700 text-sm">
                                    Diskon: −
                                    {rupiahFormatter.format(
                                        Number(order.discount_total)
                                    )}
                                </p>
                            )}
                            {order.editor && (
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Editor: {order.editor.name} (+
                                    {rupiahFormatter.format(
                                        Number(order.editor_fee)
                                    )}
                                    )
                                </p>
                            )}
                            <p className="text-oxford-navy-900 font-semibold">
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
                                <div className="flex flex-col gap-1 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
                                    <p className="text-oxford-navy-900/80 text-sm">
                                        Dikirim ke:{' '}
                                        {order.book_shipment.recipient_name},{' '}
                                        {
                                            order.book_shipment
                                                .recipient_address
                                        }{' '}
                                        ({order.book_shipment.recipient_phone}
                                        )
                                    </p>
                                    <p className="text-forest-moss-700 text-sm font-semibold">
                                        Status:{' '}
                                        {SHIPPING_STAGE_LABELS[
                                            order.book_shipment.status
                                        ] ?? order.book_shipment.status}
                                    </p>
                                    {order.book_shipment
                                        .estimated_arrival_date && (
                                        <p className="text-oxford-navy-900/70 text-sm">
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
                                            <p className="text-oxford-navy-900/70 text-xs">
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

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() =>
                                        setExpandedId(
                                            expandedId === order.id
                                                ? null
                                                : order.id
                                        )
                                    }
                                    className="text-forest-moss-700 text-xs hover:text-forest-moss-800 self-start"
                                >
                                    {expandedId === order.id
                                        ? 'Tutup Detail Pesanan'
                                        : 'Riwayat & Pesan ke Admin'}
                                </button>
                                {expandedId === order.id && (
                                    <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-3">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-oxford-navy-900 font-semibold text-sm">
                                                Riwayat Proses
                                            </p>
                                            {order.status_histories.map(
                                                (entry) => (
                                                    <div
                                                        key={entry.id}
                                                        className="text-xs"
                                                    >
                                                        <span className="text-oxford-navy-900/55">
                                                            {dateTimeFormatter.format(
                                                                new Date(
                                                                    entry.created_at
                                                                )
                                                            )}
                                                        </span>{' '}
                                                        <span className="text-oxford-navy-900/80">
                                                            {ORDER_HISTORY_EVENT_LABELS[
                                                                entry.event
                                                            ] ?? entry.event}
                                                        </span>
                                                        {entry.note && (
                                                            <p className="text-oxford-navy-900/55 italic">
                                                                {entry.note}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <OrderMessages
                                            orderId={order.id}
                                            canSend={
                                                order.status !== 'completed'
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    </div>
                )}
            </div>
        </div>
    );
}
