import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatRupiah } from '@/lib/format';

/** Pesan beli buku satuan (`/beli/buku/:id`) atau langganan (`/beli/langganan/:id`): pilih rekening tujuan. */
export default function CheckoutPage({ kind }: { kind: 'book' | 'plan' }) {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const item = useLoad(
        useCallback(async () => {
            if (kind === 'book') {
                const { data } = await api.book(id);

                return {
                    title: data.book.title,
                    price: data.price,
                    detail: data.access_days
                        ? `Akses ${data.access_days} hari`
                        : 'Akses selamanya',
                    back: `/buku/${data.id}`,
                    hasAccess: data.me?.access?.allowed === true,
                };
            }

            const { data } = await api.plans();
            const plan = data.find((row) => String(row.id) === id);

            if (!plan) throw new Error('Paket tidak ditemukan.');

            return {
                title: `Langganan ${plan.name}`,
                price: plan.price,
                detail: `Semua buku selama 1 ${plan.period_label.toLowerCase()}`,
                back: '/langganan',
                hasAccess: false,
            };
        }, [id, kind])
    );
    const methods = useLoad(useCallback(() => api.paymentMethods(), []));
    const [method, setMethod] = useState<number | null>(null);
    const [error, setError] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const accounts = methods.data?.data ?? [];
    const chosen = method ?? (accounts.length === 1 ? accounts[0].id : null);

    async function order() {
        setIsBusy(true);
        setError('');

        try {
            await api.createOrder(kind, Number(id), chosen);
            navigate('/pesanan', { replace: true });
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    if (item.error) {
        return (
            <div className="mx-auto max-w-md px-6 py-16 text-center">
                <p className="text-red-600">
                    {item.error || 'Tidak ditemukan.'}
                </p>
                <Link
                    to="/katalog"
                    className="mt-3 inline-block font-semibold text-forest-moss-700 underline"
                >
                    Ke katalog
                </Link>
            </div>
        );
    }

    if (!item.data) {
        return (
            <p className="px-6 py-16 text-center text-oxford-navy-900/70">
                Memuat...
            </p>
        );
    }

    const info = item.data;

    return (
        <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
            <Link
                to={info.back}
                className="text-sm text-forest-moss-700 hover:underline"
            >
                ← Kembali
            </Link>
            <div className="card-shadow flex flex-col gap-5 rounded-2xl bg-white p-6 ring-1 ring-forest-moss-100">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Pesan & bayar
                </h1>

                <div className="flex items-start justify-between gap-4 rounded-xl bg-forest-moss-50 p-4">
                    <div>
                        <p className="font-semibold text-oxford-navy-900">
                            {info.title}
                        </p>
                        <p className="text-sm text-oxford-navy-900/65">
                            {info.detail}
                        </p>
                    </div>
                    <p className="font-display text-xl font-bold text-oxford-navy-700">
                        {formatRupiah(info.price)}
                    </p>
                </div>

                {info.hasAccess && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                        Anda sudah punya akses ke buku ini. Pembelian akan
                        memperpanjang masa aksesnya.
                    </p>
                )}

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 font-semibold text-oxford-navy-900">
                        Transfer ke rekening
                    </legend>
                    {accounts.length === 0 && (
                        <p className="text-sm text-oxford-navy-900/65">
                            Belum ada rekening aktif; hubungi admin.
                        </p>
                    )}
                    {accounts.map((account) => (
                        <label
                            key={account.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${chosen === account.id ? 'bg-forest-moss-50 ring-forest-moss-400' : 'ring-oxford-navy-900/15'}`}
                        >
                            <input
                                type="radio"
                                name="rekening"
                                className="mt-1"
                                checked={chosen === account.id}
                                onChange={() => setMethod(account.id)}
                            />
                            <span className="text-sm">
                                <span className="block font-semibold text-oxford-navy-900">
                                    {account.bank_name} —{' '}
                                    {account.account_number}
                                </span>
                                <span className="block text-oxford-navy-900/65">
                                    a.n. {account.account_holder_name}
                                </span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                <p className="text-sm text-oxford-navy-900/65">
                    Setelah memesan, transfer dan unggah bukti di halaman
                    Pembelian & Langganan dalam 1×24 jam. Akses terbuka setelah
                    admin memverifikasi.
                </p>

                {error && (
                    <p
                        role="alert"
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
                    >
                        {error}
                    </p>
                )}

                <Button
                    onClick={order}
                    disabled={
                        isBusy || (accounts.length > 0 && chosen === null)
                    }
                    className="h-12"
                >
                    {isBusy ? 'Membuat pesanan...' : 'Buat pesanan'}
                </Button>
            </div>
        </div>
    );
}
