import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button';
import Pagination from '@/components/Pagination';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatDateTime, formatRupiah } from '@/lib/format';

const TABS = [
    { value: 'pending', label: 'Menunggu' },
    { value: 'confirmed', label: 'Dikonfirmasi' },
    { value: 'cancelled', label: 'Dibatalkan' },
    { value: '', label: 'Semua' },
];

/** Bukti transfer diambil dengan token (tidak bisa lewat tautan biasa). */
function Proof({ id }: { id: number }) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState<boolean>(false);

    useEffect(() => {
        let active = true;
        let created: string | null = null;

        api.adminProof(id)
            .then((blob) => {
                created = URL.createObjectURL(blob);
                if (active) setUrl(created);
            })
            .catch(() => active && setFailed(true));

        return () => {
            active = false;
            if (created) URL.revokeObjectURL(created);
        };
    }, [id]);

    if (failed)
        return (
            <p className="text-xs text-red-600">Bukti tidak dapat dimuat.</p>
        );
    if (!url)
        return (
            <p className="text-xs text-oxford-navy-900/60">Memuat bukti...</p>
        );

    return (
        <a href={url} target="_blank" rel="noreferrer">
            <img
                src={url}
                alt="Bukti transfer"
                className="max-h-64 rounded-lg ring-1 ring-forest-moss-200"
            />
        </a>
    );
}

function OrderRow({
    order,
    onChanged,
}: {
    order: api.Order;
    onChanged: () => void;
}) {
    const [open, setOpen] = useState<boolean>(false);
    const [note, setNote] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);

    async function verify(decision: 'approve' | 'reject') {
        setIsBusy(true);
        setMessage('');

        try {
            await api.adminVerify(order.id, decision, note.trim());
            onChanged();
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <li className="flex flex-col gap-2 rounded-xl bg-white p-4 ring-1 ring-forest-moss-100">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="font-semibold text-oxford-navy-700">
                        {order.title}
                    </p>
                    <p className="text-xs text-oxford-navy-900/65">
                        {order.order_number} • {order.user?.name} (
                        {order.user?.email}) •{' '}
                        {formatDateTime(order.created_at)}
                    </p>
                    <p className="text-xs text-oxford-navy-900/65">
                        {order.kind === 'plan' ? 'Langganan' : 'Beli buku'}
                        {order.payment_method
                            ? ` • ${order.payment_method.bank_name} ${order.payment_method.account_number}`
                            : ''}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-display text-lg font-bold text-oxford-navy-700">
                        {formatRupiah(order.amount)}
                    </p>
                    <p className="text-xs text-oxford-navy-900/65">
                        {order.status === 'pending'
                            ? order.has_payment_proof
                                ? 'Bukti diunggah'
                                : 'Belum ada bukti'
                            : order.status === 'confirmed'
                              ? 'Dikonfirmasi'
                              : 'Dibatalkan'}
                    </p>
                </div>
            </div>

            {order.has_payment_proof && (
                <button
                    type="button"
                    className="self-start text-sm font-semibold text-forest-moss-700 hover:cursor-pointer hover:underline"
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? 'Sembunyikan bukti' : 'Lihat bukti transfer'}
                </button>
            )}
            {open && <Proof id={order.id} />}

            {order.status === 'cancelled' &&
                order.payment_verification_note && (
                    <p className="text-xs text-red-700">
                        Catatan: {order.payment_verification_note}
                    </p>
                )}

            {order.status === 'pending' && order.has_payment_proof && (
                <div className="flex flex-col gap-2 rounded-lg bg-forest-moss-50/70 p-3 sm:flex-row sm:items-center">
                    <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        aria-label="Catatan untuk pembeli"
                        placeholder="Catatan (wajib dijelaskan bila ditolak)"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm"
                    />
                    <Button
                        type="button"
                        onClick={() => void verify('approve')}
                        disabled={isBusy}
                        className="h-10 py-0"
                    >
                        Terima
                    </Button>
                    <Button
                        type="button"
                        variant="outline2"
                        onClick={() => void verify('reject')}
                        disabled={isBusy}
                        className="h-10 py-0"
                    >
                        Tolak
                    </Button>
                </div>
            )}
            {message && (
                <p role="alert" className="text-xs text-red-600">
                    {message}
                </p>
            )}
        </li>
    );
}

/** Admin: verifikasi pembayaran beli buku / langganan. */
export default function AdminOrdersPage() {
    const [status, setStatus] = useState<string>('pending');
    const [page, setPage] = useState<number>(1);
    const { data, error, reload } = useLoad(
        useCallback(() => api.adminOrders({ status, page }), [status, page])
    );
    const counts = data?.meta.counts ?? {};

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Pembayaran
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Setelah bukti transfer diterima, pembaca langsung mendapat
                    akses. Pesanan tanpa bukti dibatalkan otomatis setelah 1×24
                    jam.
                </p>
            </div>

            <div role="tablist" className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={status === tab.value}
                        onClick={() => {
                            setStatus(tab.value);
                            setPage(1);
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold hover:cursor-pointer ${status === tab.value ? 'bg-oxford-navy-700 text-white' : 'bg-forest-moss-50 text-oxford-navy-700 ring-1 ring-forest-moss-200 hover:bg-forest-moss-100'}`}
                    >
                        {tab.label}
                        {tab.value ? ` (${counts[tab.value] ?? 0})` : ''}
                    </button>
                ))}
            </div>

            {error && <p className="text-red-600">{error}</p>}
            <ul className="flex flex-col gap-3">
                {data?.data.map((order) => (
                    <OrderRow key={order.id} order={order} onChanged={reload} />
                ))}
                {data && data.data.length === 0 && (
                    <li className="rounded-xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/65">
                        Tidak ada pesanan.
                    </li>
                )}
            </ul>
            <Pagination meta={data?.meta ?? null} onPageChange={setPage} />
        </div>
    );
}
