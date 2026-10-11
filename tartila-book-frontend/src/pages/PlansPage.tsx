import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button';
import { useAuth } from '@/context/auth';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatDateTime, formatRupiah } from '@/lib/format';

const PERIOD_UNIT: Record<api.Plan['period'], string> = {
    daily: 'hari',
    weekly: 'minggu',
    monthly: 'bulan',
    yearly: 'tahun',
};

export default function PlansPage() {
    const { user } = useAuth();
    const plans = useLoad(useCallback(() => api.plans(), []));
    const access = useLoad(
        useCallback(
            () => (user ? api.myAccess() : Promise.resolve(null)),
            [user]
        )
    );
    const subscription = access.data?.data.subscription;

    return (
        <div className="mx-auto flex max-w-[1000px] flex-col gap-8 px-6 py-10 sm:px-10">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700 sm:text-4xl">
                    Berlangganan Tartila Book
                </h1>
                <p className="mx-auto max-w-2xl text-oxford-navy-900/70">
                    Selama langganan aktif, <strong>semua buku</strong> bisa
                    dibaca. Tanpa langganan, buku terkunci kecuali yang sedang
                    dibuka gratis atau yang Anda beli satuan.
                </p>
            </div>

            {subscription && (
                <div className="rounded-2xl bg-forest-moss-50 p-5 text-center ring-1 ring-forest-moss-200">
                    <p className="font-semibold text-forest-moss-800">
                        Langganan {subscription.plan} Anda aktif
                    </p>
                    <p className="text-sm text-oxford-navy-900/70">
                        Berlaku sampai {formatDateTime(subscription.ends_at)}.
                        Memperpanjang menyambung setelah masa ini berakhir.
                    </p>
                </div>
            )}

            {plans.error && (
                <p className="text-center text-red-600">{plans.error}</p>
            )}

            {plans.data && plans.data.data.length === 0 && (
                <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                    Paket langganan belum tersedia.
                </p>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {plans.data?.data.map((plan) => (
                    <article
                        key={plan.id}
                        className="card-shadow flex flex-col gap-4 rounded-2xl bg-white p-6 ring-1 ring-forest-moss-100"
                    >
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-forest-moss-700">
                                {plan.period_label}
                            </p>
                            <h2 className="font-display text-xl font-bold text-oxford-navy-700">
                                {plan.name}
                            </h2>
                        </div>
                        <p className="font-display text-3xl font-bold text-oxford-navy-700">
                            {formatRupiah(plan.price)}
                            <span className="text-base font-normal text-oxford-navy-900/60">
                                {' '}
                                / {PERIOD_UNIT[plan.period]}
                            </span>
                        </p>
                        {plan.description && (
                            <p className="text-sm text-oxford-navy-900/70">
                                {plan.description}
                            </p>
                        )}
                        <ul className="flex flex-col gap-1.5 text-sm text-oxford-navy-900/80">
                            <li className="flex gap-2">
                                <i
                                    aria-hidden
                                    className="ri-check-line text-forest-moss-600"
                                />
                                Semua buku terbuka
                            </li>
                            <li className="flex gap-2">
                                <i
                                    aria-hidden
                                    className="ri-check-line text-forest-moss-600"
                                />
                                Mode gulir & balik halaman
                            </li>
                            <li className="flex gap-2">
                                <i
                                    aria-hidden
                                    className="ri-check-line text-forest-moss-600"
                                />
                                Penanda & lanjut baca
                            </li>
                        </ul>
                        <Link
                            to={
                                user
                                    ? `/beli/langganan/${plan.id}`
                                    : `/masuk?next=${encodeURIComponent(`/beli/langganan/${plan.id}`)}`
                            }
                            className="mt-auto"
                        >
                            <Button className="w-full">
                                {subscription ? 'Perpanjang' : 'Pilih paket'}
                            </Button>
                        </Link>
                    </article>
                ))}
            </div>

            <p className="text-center text-sm text-oxford-navy-900/60">
                Pembayaran lewat transfer; akses terbuka setelah admin
                memverifikasi bukti transfer Anda.
            </p>
        </div>
    );
}
