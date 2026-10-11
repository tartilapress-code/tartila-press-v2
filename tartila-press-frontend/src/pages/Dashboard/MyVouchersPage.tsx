import { useCallback, useEffect, useState } from 'react';
import {
    CreateVoucherForm,
    VoucherRows,
} from '@/components/voucher/CreatorVoucherList';
import StatusBadge from '@/components/voucher/StatusBadge';
import {
    formatDate,
    percent,
    rupiah,
    targetsText,
} from '@/components/voucher/voucherFormat';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

export default function MyVouchersPage() {
    const [data, setData] = useState<voucherApi.MyVouchers | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const load = useCallback(() => {
        return voucherApi
            .mine()
            .then((response) => setData(response.data))
            .catch((caught) => setErrorMessage(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function handleToggle(voucher: voucherApi.Voucher) {
        setErrorMessage('');

        try {
            await voucherApi.toggleMine(voucher.id, !voucher.is_active);
            await load();
        } catch (caught) {
            setErrorMessage(describeApiError(caught));
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!data) {
        return <p className="text-red-600 text-sm">{errorMessage}</p>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Voucher Saya
                </h5>
                <p className="text-oxford-navy-900/80 text-sm">
                    Buat kode voucher untuk bukumu. Voucher berlaku untuk siapa
                    pun, termasuk Anda sendiri. Voucher dari hak admin memberi
                    diskon ke pembeli dan fee ke Anda; voucher dari royalti
                    memotong royalti Anda sendiri.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-forest-moss-50 p-4">
                        <p className="text-oxford-navy-900/70 text-xs">
                            Fee dari voucher (pesanan selesai)
                        </p>
                        <p className="text-forest-moss-700 text-xl font-bold">
                            {rupiah.format(data.totals.fee_earned)}
                        </p>
                    </div>
                    <div className="rounded-xl bg-forest-moss-50 p-4">
                        <p className="text-oxford-navy-900/70 text-xs">
                            Total pemakaian voucher
                        </p>
                        <p className="text-oxford-navy-700 text-xl font-bold">
                            {data.totals.uses}×
                        </p>
                    </div>
                </div>
                {errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                )}
            </div>

            {!data.eligible && (
                <div className={cardClass}>
                    <p className="text-oxford-navy-900/80 text-sm">
                        Voucher hanya untuk penulis/editor yang sudah memiliki
                        naskah terbit. Fitur ini akan terbuka setelah naskah
                        Anda terbit.
                    </p>
                </div>
            )}

            {data.eligible && (
                <>
                    <div className={cardClass}>
                        <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                            Hak voucher dari admin
                        </h5>

                        {data.grants.length === 0 ? (
                            <p className="text-oxford-navy-900/60 text-sm">
                                Admin belum memberi Anda hak voucher.
                            </p>
                        ) : (
                            data.grants.map((grant) => (
                                <GrantCard
                                    key={grant.id}
                                    grant={grant}
                                    onChanged={load}
                                    onToggle={handleToggle}
                                />
                            ))
                        )}
                    </div>

                    <div className={cardClass}>
                        <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                            Voucher dari royalti buku sendiri
                        </h5>

                        {data.royalty_books.length === 0 ? (
                            <p className="text-oxford-navy-900/60 text-sm">
                                Belum ada buku terbit dengan royalti.
                            </p>
                        ) : (
                            data.royalty_books.map((book) => (
                                <div
                                    key={book.book_id}
                                    className="flex flex-col gap-3 border-t border-forest-moss-100 pt-4 first:border-t-0 first:pt-0"
                                >
                                    <div>
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {book.title}
                                        </p>
                                        <p className="text-oxford-navy-900/70 text-xs">
                                            Royalti Anda{' '}
                                            {percent(book.royalty_percentage)}
                                        </p>
                                    </div>
                                    <VoucherRows
                                        vouchers={book.vouchers}
                                        onToggle={handleToggle}
                                    />
                                    <CreateVoucherForm
                                        maxPercent={book.royalty_percentage}
                                        withFee={false}
                                        onSubmit={async (payload) => {
                                            await voucherApi.createMine({
                                                source: 'royalty',
                                                book_id: book.book_id,
                                                ...payload,
                                            });
                                            await load();
                                        }}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function GrantCard({
    grant,
    onChanged,
    onToggle,
}: {
    grant: voucherApi.MyGrant;
    onChanged: () => Promise<unknown>;
    onToggle: (voucher: voucherApi.Voucher) => void;
}) {
    const quotaLeft = grant.max_vouchers - grant.used_quota;
    const isRunning = grant.status === 'active';

    return (
        <div className="flex flex-col gap-3 border-t border-forest-moss-100 pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <p className="text-oxford-navy-900 font-semibold">
                    {grant.name || targetsText(grant.targets)}
                </p>
                <StatusBadge
                    status={grant.status === 'active' ? 'active' : grant.status}
                />
            </div>
            <p className="text-oxford-navy-900/70 text-xs">
                Untuk: {targetsText(grant.targets)} • Kolam{' '}
                {percent(grant.pool_percent)} (diskon + fee) • Maksimal{' '}
                {grant.max_vouchers} voucher per {grant.period_days} hari
            </p>
            {isRunning && grant.cycle_ends_at && (
                <p className="text-oxford-navy-900/70 text-xs">
                    Periode ini berakhir {formatDate(grant.cycle_ends_at)} •
                    kuota terpakai {grant.used_quota}/{grant.max_vouchers}.
                    Setelah itu voucher lama tidak berlaku dan kuota kembali
                    penuh.
                </p>
            )}

            <VoucherRows vouchers={grant.vouchers} onToggle={onToggle} />

            {isRunning && (
                <CreateVoucherForm
                    maxPercent={grant.pool_percent}
                    withFee
                    disabled={quotaLeft <= 0}
                    onSubmit={async (payload) => {
                        await voucherApi.createMine({
                            source: 'grant',
                            grant_id: grant.id,
                            ...payload,
                        });
                        await onChanged();
                    }}
                />
            )}
            {isRunning && quotaLeft <= 0 && (
                <p className="text-amber-700 text-sm">
                    Kuota voucher periode ini sudah habis.
                </p>
            )}
        </div>
    );
}
