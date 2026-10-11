import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatDateTime, formatRupiah } from '@/lib/format';

const STATUS: Record<api.Order['status'], { label: string; tone: string }> = {
    pending: {
        label: 'Menunggu pembayaran / verifikasi',
        tone: 'bg-amber-50 text-amber-800 ring-amber-200',
    },
    confirmed: {
        label: 'Dikonfirmasi',
        tone: 'bg-forest-moss-50 text-forest-moss-800 ring-forest-moss-200',
    },
    cancelled: {
        label: 'Dibatalkan',
        tone: 'bg-red-50 text-red-700 ring-red-200',
    },
};

function OrderCard({
    order,
    onChanged,
}: {
    order: api.Order;
    onChanged: () => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const status = STATUS[order.status];
    const canPay = order.status === 'pending';

    async function upload() {
        if (!file) return;

        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await api.uploadProof(order.id, file);
            setMessage(
                response.data.has_payment_proof
                    ? 'Bukti diunggah. Menunggu verifikasi admin.'
                    : ''
            );
            setFile(null);
            onChanged();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
            onChanged();
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <article className="card-shadow flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-forest-moss-100">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="font-semibold text-oxford-navy-900">
                        {order.title}
                    </p>
                    <p className="text-xs text-oxford-navy-900/60">
                        {order.order_number} •{' '}
                        {formatDateTime(order.created_at)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-display text-lg font-bold text-oxford-navy-700">
                        {formatRupiah(order.amount)}
                    </p>
                    <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${status.tone}`}
                    >
                        {status.label}
                    </span>
                </div>
            </div>

            {order.status === 'confirmed' && (
                <p className="text-sm text-forest-moss-800">
                    Dikonfirmasi {formatDateTime(order.confirmed_at)}.{' '}
                    <Link to="/rak" className="font-semibold underline">
                        Buka rak saya
                    </Link>
                </p>
            )}

            {order.status === 'cancelled' &&
                order.payment_verification_note && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        Catatan: {order.payment_verification_note}
                    </p>
                )}

            {canPay && (
                <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/70 p-4">
                    {order.payment_method ? (
                        <p className="text-sm text-oxford-navy-900">
                            Transfer{' '}
                            <strong>{formatRupiah(order.amount)}</strong> ke{' '}
                            <strong>
                                {order.payment_method.bank_name}{' '}
                                {order.payment_method.account_number}
                            </strong>{' '}
                            a.n. {order.payment_method.account_holder_name}.
                        </p>
                    ) : (
                        <p className="text-sm text-oxford-navy-900">
                            Transfer {formatRupiah(order.amount)} sesuai arahan
                            admin.
                        </p>
                    )}
                    {!order.has_payment_proof && order.payment_due_at && (
                        <p className="text-xs text-amber-800">
                            Batas unggah bukti:{' '}
                            {formatDateTime(order.payment_due_at)} (dibatalkan
                            otomatis bila lewat).
                        </p>
                    )}
                    {order.has_payment_proof && (
                        <p className="text-sm font-medium text-forest-moss-800">
                            Bukti sudah diunggah — menunggu verifikasi admin.
                            Anda bisa mengganti bukti bila salah.
                        </p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            aria-label={`Bukti transfer ${order.order_number}`}
                            onChange={(e) =>
                                setFile(e.target.files?.[0] ?? null)
                            }
                            className="text-sm"
                        />
                        <button
                            type="button"
                            disabled={!file || isBusy}
                            onClick={upload}
                            className="h-10 rounded-lg bg-oxford-navy-700 px-4 text-sm font-semibold text-white hover:cursor-pointer hover:bg-oxford-navy-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isBusy
                                ? 'Mengunggah...'
                                : order.has_payment_proof
                                  ? 'Ganti bukti'
                                  : 'Unggah bukti'}
                        </button>
                    </div>
                    {message && (
                        <p
                            className={`text-xs ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                        >
                            {message}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
}

export default function OrdersPage() {
    const loader = useCallback(() => api.myOrders(), []);
    const { data, error, reload } = useLoad(loader);
    const access = useLoad(useCallback(() => api.myAccess(), []));
    const sub = access.data?.data.subscription;
    const purchases = access.data?.data.purchases ?? [];

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 sm:px-10">
            <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                Pembelian & Langganan
            </h1>

            <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-moss-800">
                        Langganan
                    </p>
                    {sub ? (
                        <p className="mt-1 text-sm text-oxford-navy-900">
                            Paket <strong>{sub.plan}</strong> aktif sampai{' '}
                            {formatDateTime(sub.ends_at)}.
                        </p>
                    ) : (
                        <p className="mt-1 text-sm text-oxford-navy-900/70">
                            Belum berlangganan.{' '}
                            <Link
                                to="/langganan"
                                className="font-semibold text-forest-moss-700 underline"
                            >
                                Lihat paket
                            </Link>
                        </p>
                    )}
                </div>
                <div className="rounded-2xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-moss-800">
                        Buku yang dibeli (aktif)
                    </p>
                    {purchases.length === 0 ? (
                        <p className="mt-1 text-sm text-oxford-navy-900/70">
                            Belum ada.
                        </p>
                    ) : (
                        <ul className="mt-1 text-sm text-oxford-navy-900">
                            {purchases.map((purchase) => (
                                <li key={purchase.reader_book_id}>
                                    <Link
                                        to={`/buku/${purchase.reader_book_id}`}
                                        className="font-semibold underline"
                                    >
                                        {purchase.title}
                                    </Link>{' '}
                                    <span className="text-oxford-navy-900/60">
                                        {purchase.ends_at
                                            ? `sampai ${formatDateTime(purchase.ends_at)}`
                                            : '(selamanya)'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {error && <p className="text-red-600">{error}</p>}
            {data && data.data.length === 0 && (
                <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                    Belum ada pesanan.
                </p>
            )}

            <div className="flex flex-col gap-4">
                {data?.data.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        onChanged={reload}
                    />
                ))}
            </div>
        </div>
    );
}
