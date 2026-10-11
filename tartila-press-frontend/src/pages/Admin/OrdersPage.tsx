import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import AccountSelect from '@/components/finance/AccountSelect';
import OrderMessages from '@/components/order/OrderMessages';
import Pagination from '@/components/ui/Pagination';
import * as adminApi from '@/data/admin/adminApi';
import type { BookShipmentPayload } from '@/data/admin/adminApi';
import type { OrderCategory } from '@/lib/orderCategory';
import type { PageMeta } from '@/lib/pagination';
import { SHIPPING_STAGES, SHIPPING_STAGE_LABELS } from '@/lib/shippingStatus';
import { ApiError } from '@/lib/http';
import { UnreadDot } from '@/components/notification/UnreadBadge';
import { useUnreadSubjects } from '@/context/useNotifications';

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
    voucher_code?: string | null;
    voucher_discount?: string;
    total: string;
    created_at: string;
    user: { id: number; name: string; email: string };
    editor: { id: number; name: string } | null;
    items: OrderItem[];
    book_shipment: BookShipment | null;
    payment_proof_url: string | null;
    invoice_number: string | null;
    payment_due_at: string | null;
    // Rekening yang dipilih pembeli di invoice.
    payment_method: {
        id: number;
        bank_name: string;
        account_number: string;
    } | null;
};

const statusOptions = [
    { value: 'pending', label: 'Menunggu Konfirmasi' },
    { value: 'confirmed', label: 'Sudah Dikonfirmasi' },
    { value: 'completed', label: 'Selesai' },
    { value: 'cancelled', label: 'Dibatalkan' },
];

const categoryTabs: { value: OrderCategory; label: string }[] = [
    { value: 'book', label: 'Pesanan Buku Fisik' },
    { value: 'package', label: 'Paket Penerbitan' },
    { value: 'book_chapter', label: 'Book Chapter' },
    { value: 'event', label: 'Event' },
];

const sortOptions = [
    { value: 'time_desc', label: 'Waktu Order Terbaru' },
    { value: 'time_asc', label: 'Waktu Order Terlama' },
    { value: 'status_asc', label: 'Status: Menunggu → Selesai' },
    { value: 'status_desc', label: 'Status: Selesai → Menunggu' },
];

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

// Batas bayar invoice dalam WIB.
const dueFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function ShipmentDetail({
    shipment,
    onSaved,
}: {
    shipment: BookShipment;
    onSaved: () => void;
}) {
    const [status, setStatus] = useState<string>(shipment.status);
    const [estimatedDate, setEstimatedDate] = useState<string>(
        shipment.estimated_arrival_date
            ? shipment.estimated_arrival_date.slice(0, 10)
            : ''
    );
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleSave() {
        setIsSaving(true);
        setError('');

        try {
            await adminApi.updateBookShipment(shipment.id, {
                status: status as BookShipmentPayload['status'],
                estimated_arrival_date: estimatedDate || null,
            });
            onSaved();
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal menyimpan progres pengiriman.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-4">
            <div className="text-oxford-navy-900/80 text-sm flex flex-col gap-1">
                <p>
                    <span className="text-oxford-navy-900/55">Penerima:</span>{' '}
                    {shipment.recipient_name}
                </p>
                <p>
                    <span className="text-oxford-navy-900/55">
                        No. WhatsApp:
                    </span>{' '}
                    {shipment.recipient_phone}
                </p>
                <p>
                    <span className="text-oxford-navy-900/55">Alamat:</span>{' '}
                    {shipment.recipient_address}
                </p>
            </div>

            <div className="flex flex-row flex-wrap items-end gap-3">
                <div className="w-64">
                    <Select
                        name={`shipment-status-${shipment.id}`}
                        label="Progres Pengiriman"
                        option_data={[...SHIPPING_STAGES]}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-oxford-navy-900 text-sm">
                        Estimasi Sampai
                    </label>
                    <input
                        type="date"
                        value={estimatedDate}
                        onChange={(e) => setEstimatedDate(e.target.value)}
                        className="p-3 rounded-xl ring-1 ring-forest-moss-200 bg-forest-moss-50 text-oxford-navy-900 outline-none"
                    />
                </div>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Menyimpan...' : 'Simpan Progres'}
                </Button>
            </div>

            {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
    );
}

function PaymentVerificationActions({
    orderId,
    defaultAccountId,
    onDone,
}: {
    orderId: number;
    // Rekening pilihan pembeli: terpilih otomatis sebagai penerima.
    defaultAccountId: number | null;
    onDone: () => void;
}) {
    const [showRejectNote, setShowRejectNote] = useState<boolean>(false);
    const [note, setNote] = useState<string>('');
    const [accountId, setAccountId] = useState<number | null>(defaultAccountId);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleDecision(decision: 'approve' | 'reject') {
        setIsSubmitting(true);
        setError('');

        try {
            await adminApi.verifyPayment(orderId, {
                decision,
                note: decision === 'reject' ? note || undefined : undefined,
                payment_method_id:
                    decision === 'approve' ? accountId : undefined,
            });
            onDone();
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal memverifikasi pembayaran.'
            );
            setIsSubmitting(false);
        }
    }

    if (showRejectNote) {
        return (
            <div className="flex flex-col gap-1 mt-1">
                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Alasan penolakan (opsional)"
                    className="text-xs p-1 rounded bg-forest-moss-50 ring-1 ring-forest-moss-100 text-oxford-navy-900 outline-none"
                />
                <div className="flex flex-row gap-2">
                    <button
                        onClick={() => handleDecision('reject')}
                        disabled={isSubmitting}
                        className="text-red-600 text-xs hover:text-red-700 font-semibold"
                    >
                        Konfirmasi Tolak
                    </button>
                    <button
                        onClick={() => setShowRejectNote(false)}
                        className="text-oxford-navy-900/55 text-xs"
                    >
                        Batal
                    </button>
                </div>
                {error && <p className="text-red-600 text-xs">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 mt-1">
            <AccountSelect
                label="Masuk ke rekening"
                value={accountId}
                onChange={setAccountId}
            />
            <div className="flex flex-row gap-2">
                <button
                    onClick={() => handleDecision('approve')}
                    disabled={isSubmitting}
                    className="text-forest-moss-700 text-xs hover:text-forest-moss-800 font-semibold"
                >
                    ACC
                </button>
                <button
                    onClick={() => setShowRejectNote(true)}
                    disabled={isSubmitting}
                    className="text-red-600 text-xs hover:text-red-700 font-semibold"
                >
                    Tolak
                </button>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
    );
}

export default function OrdersPage() {
    const unreadOrders = useUnreadSubjects('order');
    const [visibleOrders, setVisibleOrders] = useState<OrderRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeCategory, setActiveCategory] = useState<OrderCategory>('book');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [sort, setSort] = useState<string>('time_desc');
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [counts, setCounts] = useState<
        Partial<Record<OrderCategory, number>>
    >({});
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Kategori, status, urutan & halaman dikerjakan server.
    const loadOrders = useCallback(() => {
        adminApi
            .listOrders({
                category: activeCategory,
                status: statusFilter,
                sort,
                page,
            })
            .then((response) => {
                setVisibleOrders(response.data);
                setMeta(response.meta ?? null);
                setCounts(response.meta?.counts ?? {});
            })
            .finally(() => setIsLoading(false));
    }, [activeCategory, statusFilter, sort, page]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    async function handleStatusChange(orderId: number, status: string) {
        await adminApi.updateOrderStatus(orderId, status);
        loadOrders();
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap gap-2">
                {categoryTabs.map((tab) => (
                    <Button
                        key={tab.value}
                        variant={
                            activeCategory === tab.value
                                ? 'primary'
                                : 'outline2'
                        }
                        onClick={() => {
                            setActiveCategory(tab.value);
                            setPage(1);
                        }}
                    >
                        {tab.label} ({counts[tab.value] ?? 0})
                    </Button>
                ))}
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        {
                            categoryTabs.find(
                                (tab) => tab.value === activeCategory
                            )?.label
                        }
                    </h5>

                    <div className="flex flex-row flex-wrap gap-3">
                        <div className="w-56">
                            <Select
                                name="status_filter"
                                label="Filter Status"
                                option_data={[
                                    { value: '', label: 'Semua Status' },
                                    ...statusOptions,
                                ]}
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                        <div className="w-64">
                            <Select
                                name="sort"
                                label="Urutkan"
                                option_data={sortOptions}
                                value={sort}
                                onChange={(e) => {
                                    setSort(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : visibleOrders.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada pesanan.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="text-oxford-navy-900/65 border-b border-forest-moss-200">
                                    <th className="p-2 font-medium">Kode</th>
                                    <th className="p-2 font-medium">
                                        Nama Produk
                                    </th>
                                    <th className="p-2 font-medium">
                                        Nama Pembeli
                                    </th>
                                    <th className="p-2 font-medium">Harga</th>
                                    <th className="p-2 font-medium">
                                        Waktu Order
                                    </th>
                                    <th className="p-2 font-medium">Status</th>
                                    <th className="p-2 font-medium">
                                        Bukti Pembayaran
                                    </th>
                                    <th className="p-2 font-medium">Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleOrders.map((order) => (
                                    <Fragment key={order.id}>
                                        <tr className="border-b border-forest-moss-100 align-top">
                                            <td className="p-2 text-oxford-navy-900 font-semibold whitespace-nowrap">
                                                <span className="flex items-center gap-2">
                                                    {unreadOrders.has(
                                                        order.id
                                                    ) && <UnreadDot />}
                                                    {order.order_number}
                                                </span>
                                            </td>
                                            <td className="p-2 text-oxford-navy-900/80">
                                                {order.items
                                                    .map((item) => item.name)
                                                    .join(', ')}
                                                {order.editor && (
                                                    <div className="text-oxford-navy-900/55 text-xs">
                                                        Editor:{' '}
                                                        {order.editor.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 text-oxford-navy-900/80">
                                                {order.user.name}
                                                <div className="text-oxford-navy-900/55 text-xs">
                                                    {order.user.email}
                                                </div>
                                            </td>
                                            <td className="p-2 text-forest-moss-700 font-semibold whitespace-nowrap">
                                                {rupiahFormatter.format(
                                                    Number(order.total)
                                                )}
                                                {order.voucher_code && (
                                                    <div className="text-oxford-navy-900/55 text-xs font-normal">
                                                        Voucher{' '}
                                                        {order.voucher_code}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 text-oxford-navy-900/70 whitespace-nowrap">
                                                {dateFormatter.format(
                                                    new Date(order.created_at)
                                                )}
                                            </td>
                                            <td className="p-2 w-52 min-w-[11rem]">
                                                <Select
                                                    name={`status-${order.id}`}
                                                    option_data={statusOptions}
                                                    value={order.status}
                                                    onChange={(e) =>
                                                        handleStatusChange(
                                                            order.id,
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="p-2 w-40">
                                                {order.payment_proof_url ? (
                                                    <div className="flex flex-col gap-1">
                                                        <a
                                                            href={
                                                                order.payment_proof_url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-forest-moss-700 text-xs underline hover:text-forest-moss-800"
                                                        >
                                                            Lihat Bukti
                                                        </a>
                                                        {order.status ===
                                                            'pending' && (
                                                            <PaymentVerificationActions
                                                                orderId={
                                                                    order.id
                                                                }
                                                                defaultAccountId={
                                                                    order
                                                                        .payment_method
                                                                        ?.id ??
                                                                    null
                                                                }
                                                                onDone={
                                                                    loadOrders
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-oxford-navy-900/45 text-xs">
                                                        Belum upload
                                                        {order.status ===
                                                            'pending' &&
                                                            order.payment_due_at &&
                                                            ` · batas ${dueFormatter.format(new Date(order.payment_due_at))} WIB`}
                                                    </span>
                                                )}
                                                {order.payment_method && (
                                                    <p className="mt-1 text-oxford-navy-900/65 text-xs">
                                                        Ke{' '}
                                                        {
                                                            order.payment_method
                                                                .bank_name
                                                        }{' '}
                                                        {
                                                            order.payment_method
                                                                .account_number
                                                        }
                                                    </p>
                                                )}
                                                <Link
                                                    to={`/dashboard/pesanan/${order.id}/invoice`}
                                                    className="mt-1 block text-forest-moss-700 text-xs underline"
                                                >
                                                    Invoice
                                                </Link>
                                            </td>
                                            <td className="p-2 whitespace-nowrap">
                                                <button
                                                    onClick={() =>
                                                        setExpandedId(
                                                            expandedId ===
                                                                order.id
                                                                ? null
                                                                : order.id
                                                        )
                                                    }
                                                    className="text-forest-moss-700 text-xs hover:text-forest-moss-800"
                                                >
                                                    {order.book_shipment &&
                                                        `${
                                                            SHIPPING_STAGE_LABELS[
                                                                order
                                                                    .book_shipment
                                                                    .status
                                                            ] ??
                                                            order.book_shipment
                                                                .status
                                                        } — `}
                                                    {expandedId === order.id
                                                        ? 'Tutup'
                                                        : 'Detail'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedId === order.id && (
                                            <tr className="border-b border-forest-moss-100">
                                                <td colSpan={8} className="p-2">
                                                    <div className="flex flex-col gap-4">
                                                        {order.book_shipment && (
                                                            <ShipmentDetail
                                                                shipment={
                                                                    order.book_shipment
                                                                }
                                                                onSaved={
                                                                    loadOrders
                                                                }
                                                            />
                                                        )}
                                                        <OrderMessages
                                                            orderId={order.id}
                                                            canSend={
                                                                order.status !==
                                                                'completed'
                                                            }
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination meta={meta} onPageChange={setPage} />
            </div>
        </div>
    );
}
