import { Fragment, useEffect, useMemo, useState } from 'react';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import type { BookShipmentPayload } from '@/data/admin/adminApi';
import { getOrderCategory, type OrderCategory } from '@/lib/orderCategory';
import { SHIPPING_STAGES, SHIPPING_STAGE_LABELS } from '@/lib/shippingStatus';
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
    total: string;
    created_at: string;
    user: { id: number; name: string; email: string };
    editor: { id: number; name: string } | null;
    items: OrderItem[];
    book_shipment: BookShipment | null;
    payment_proof_url: string | null;
};

const statusOptions = [
    { value: 'pending', label: 'Menunggu Konfirmasi' },
    { value: 'confirmed', label: 'Sudah Dikonfirmasi' },
    { value: 'completed', label: 'Selesai' },
    { value: 'cancelled', label: 'Dibatalkan' },
];

// Urutan makna status (bukan alfabetis) - dipakai untuk sort by status.
const STATUS_RANK: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    completed: 2,
    cancelled: 3,
};

const categoryTabs: { value: OrderCategory; label: string }[] = [
    { value: 'book', label: 'Pesanan Buku Fisik' },
    { value: 'package', label: 'Paket Penerbitan' },
    { value: 'book_chapter', label: 'Book Chapter' },
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
        <div className="flex flex-col gap-3 bg-oxford-navy-900/60 rounded-lg p-4">
            <div className="text-white/80 text-sm flex flex-col gap-1">
                <p>
                    <span className="text-white/50">Penerima:</span>{' '}
                    {shipment.recipient_name}
                </p>
                <p>
                    <span className="text-white/50">No. WhatsApp:</span>{' '}
                    {shipment.recipient_phone}
                </p>
                <p>
                    <span className="text-white/50">Alamat:</span>{' '}
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
                    <label className="text-white text-sm">
                        Estimasi Sampai
                    </label>
                    <input
                        type="date"
                        value={estimatedDate}
                        onChange={(e) => setEstimatedDate(e.target.value)}
                        className="p-3 rounded-xl ring-1 ring-white/30 bg-white/5 text-white outline-none"
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

            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
}

function PaymentVerificationActions({
    orderId,
    onDone,
}: {
    orderId: number;
    onDone: () => void;
}) {
    const [showRejectNote, setShowRejectNote] = useState<boolean>(false);
    const [note, setNote] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleDecision(decision: 'approve' | 'reject') {
        setIsSubmitting(true);
        setError('');

        try {
            await adminApi.verifyPayment(orderId, {
                decision,
                note: decision === 'reject' ? note || undefined : undefined,
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
                    className="text-xs p-1 rounded bg-white/5 ring-1 ring-white/20 text-white outline-none"
                />
                <div className="flex flex-row gap-2">
                    <button
                        onClick={() => handleDecision('reject')}
                        disabled={isSubmitting}
                        className="text-red-400 text-xs hover:text-red-300 font-semibold"
                    >
                        Konfirmasi Tolak
                    </button>
                    <button
                        onClick={() => setShowRejectNote(false)}
                        className="text-white/50 text-xs"
                    >
                        Batal
                    </button>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 mt-1">
            <div className="flex flex-row gap-2">
                <button
                    onClick={() => handleDecision('approve')}
                    disabled={isSubmitting}
                    className="text-forest-moss-300 text-xs hover:text-forest-moss-200 font-semibold"
                >
                    ACC
                </button>
                <button
                    onClick={() => setShowRejectNote(true)}
                    disabled={isSubmitting}
                    className="text-red-400 text-xs hover:text-red-300 font-semibold"
                >
                    Tolak
                </button>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeCategory, setActiveCategory] = useState<OrderCategory>('book');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [sort, setSort] = useState<string>('time_desc');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    function loadOrders() {
        adminApi
            .listOrders()
            .then((response) => setOrders(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadOrders();
    }, []);

    async function handleStatusChange(orderId: number, status: string) {
        await adminApi.updateOrderStatus(orderId, status);
        loadOrders();
    }

    const grouped = useMemo(() => {
        const groups: Record<OrderCategory, OrderRecord[]> = {
            book: [],
            package: [],
            book_chapter: [],
        };

        orders.forEach((order) => {
            const category = getOrderCategory(order.items[0]?.itemable_type);
            if (category) {
                groups[category].push(order);
            }
        });

        return groups;
    }, [orders]);

    const visibleOrders = useMemo(() => {
        const filtered = statusFilter
            ? grouped[activeCategory].filter(
                  (order) => order.status === statusFilter
              )
            : grouped[activeCategory];

        return [...filtered].sort((a, b) => {
            if (sort === 'time_desc') {
                return b.created_at.localeCompare(a.created_at);
            }
            if (sort === 'time_asc') {
                return a.created_at.localeCompare(b.created_at);
            }

            const rankA = STATUS_RANK[a.status] ?? 99;
            const rankB = STATUS_RANK[b.status] ?? 99;

            return sort === 'status_asc' ? rankA - rankB : rankB - rankA;
        });
    }, [grouped, activeCategory, statusFilter, sort]);

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
                        onClick={() => setActiveCategory(tab.value)}
                    >
                        {tab.label} ({grouped[tab.value].length})
                    </Button>
                ))}
            </div>

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h5 className="text-white text-xl font-semibold">
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
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                            />
                        </div>
                        <div className="w-64">
                            <Select
                                name="sort"
                                label="Urutkan"
                                option_data={sortOptions}
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : visibleOrders.length === 0 ? (
                    <p className="text-white/70 text-sm">
                        Belum ada pesanan.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="text-white/60 border-b border-white/20">
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
                                    {activeCategory === 'book' && (
                                        <th className="p-2 font-medium">
                                            Pengiriman
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleOrders.map((order) => (
                                    <Fragment key={order.id}>
                                        <tr className="border-b border-white/10 align-top">
                                            <td className="p-2 text-white font-semibold whitespace-nowrap">
                                                {order.order_number}
                                            </td>
                                            <td className="p-2 text-white/80">
                                                {order.items
                                                    .map((item) => item.name)
                                                    .join(', ')}
                                                {order.editor && (
                                                    <div className="text-white/50 text-xs">
                                                        Editor:{' '}
                                                        {order.editor.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 text-white/80">
                                                {order.user.name}
                                                <div className="text-white/50 text-xs">
                                                    {order.user.email}
                                                </div>
                                            </td>
                                            <td className="p-2 text-forest-moss-300 font-semibold whitespace-nowrap">
                                                {rupiahFormatter.format(
                                                    Number(order.total)
                                                )}
                                            </td>
                                            <td className="p-2 text-white/70 whitespace-nowrap">
                                                {dateFormatter.format(
                                                    new Date(order.created_at)
                                                )}
                                            </td>
                                            <td className="p-2 w-52">
                                                <Select
                                                    name={`status-${order.id}`}
                                                    option_data={
                                                        statusOptions
                                                    }
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
                                                            className="text-forest-moss-300 text-xs underline hover:text-forest-moss-200"
                                                        >
                                                            Lihat Bukti
                                                        </a>
                                                        {order.status ===
                                                            'pending' && (
                                                            <PaymentVerificationActions
                                                                orderId={
                                                                    order.id
                                                                }
                                                                onDone={
                                                                    loadOrders
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-white/40 text-xs">
                                                        Belum upload
                                                    </span>
                                                )}
                                            </td>
                                            {activeCategory === 'book' && (
                                                <td className="p-2 whitespace-nowrap">
                                                    {order.book_shipment ? (
                                                        <button
                                                            onClick={() =>
                                                                setExpandedId(
                                                                    expandedId ===
                                                                        order.id
                                                                        ? null
                                                                        : order.id
                                                                )
                                                            }
                                                            className="text-forest-moss-300 text-xs hover:text-forest-moss-200"
                                                        >
                                                            {SHIPPING_STAGE_LABELS[
                                                                order
                                                                    .book_shipment
                                                                    .status
                                                            ] ??
                                                                order
                                                                    .book_shipment
                                                                    .status}
                                                            {' — '}
                                                            {expandedId ===
                                                            order.id
                                                                ? 'Tutup'
                                                                : 'Detail'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-white/40 text-xs">
                                                            Tidak ada data
                                                            pengiriman
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        {activeCategory === 'book' &&
                                            expandedId === order.id &&
                                            order.book_shipment && (
                                                <tr className="border-b border-white/10">
                                                    <td
                                                        colSpan={8}
                                                        className="p-2"
                                                    >
                                                        <ShipmentDetail
                                                            shipment={
                                                                order.book_shipment
                                                            }
                                                            onSaved={
                                                                loadOrders
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

