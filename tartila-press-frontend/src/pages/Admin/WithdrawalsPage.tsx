import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import AccountSelect from '@/components/finance/AccountSelect';
import * as walletApi from '@/data/wallet/walletApi';
import { describeApiError } from '@/lib/apiErrors';
import Pagination from '@/components/ui/Pagination';
import type { PageMeta } from '@/lib/pagination';

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const STATUS_CLASS: Record<walletApi.WithdrawalStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-forest-moss-100 text-forest-moss-800',
    rejected: 'bg-red-100 text-red-700',
};

export default function WithdrawalsPage() {
    const [items, setItems] = useState<walletApi.Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<string>('pending');
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [accounts, setAccounts] = useState<Record<number, number | null>>({});
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);

    // Status & halaman dikerjakan server.
    const load = useCallback(() => {
        return walletApi
            .adminList({ status: filter === 'all' ? '' : filter, page })
            .then((response) => {
                setItems(response.data);
                setMeta(response.meta ?? null);
            })
            .catch((caught) => {
                setIsError(true);
                setMessage(describeApiError(caught));
            })
            .finally(() => setIsLoading(false));
    }, [filter, page]);

    useEffect(() => {
        load();
    }, [load]);

    async function process(item: walletApi.Withdrawal, pay: boolean) {
        setBusyId(item.id);
        setMessage('');
        setIsError(false);

        try {
            const response = pay
                ? await walletApi.adminPay(
                      item.id,
                      notes[item.id],
                      accounts[item.id] ?? null
                  )
                : await walletApi.adminReject(item.id, notes[item.id]);
            setMessage(response.message);
            await load();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusyId(null);
        }
    }

    const visible = items;

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Penarikan Saldo
            </h5>
            <p className="text-oxford-navy-900/80 text-sm">
                Transfer sebesar &quot;diterima&quot; ke rekening pemohon, lalu
                tandai sudah dibayar. Kalau ditolak, dana kembali ke saldo
                pemohon.
            </p>

            <select
                value={filter}
                onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                }}
                className="self-start rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
            >
                <option value="pending">Menunggu diproses</option>
                <option value="paid">Sudah ditransfer</option>
                <option value="rejected">Ditolak</option>
                <option value="all">Semua</option>
            </select>

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : visible.length === 0 ? (
                <p className="text-oxford-navy-900/60 text-sm">
                    Tidak ada penarikan.
                </p>
            ) : (
                visible.map((item) => (
                    <div
                        key={item.id}
                        className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-4"
                    >
                        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                            <p className="text-oxford-navy-900 font-semibold">
                                {item.user?.name}{' '}
                                <span className="text-oxford-navy-900/60 font-normal text-xs">
                                    {item.user?.email}
                                </span>
                            </p>
                            <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status]}`}
                            >
                                {walletApi.STATUS_LABEL[item.status]}
                            </span>
                        </div>
                        <p className="text-oxford-navy-900 text-sm">
                            Diminta {rupiah.format(Number(item.amount))} • biaya
                            admin {rupiah.format(Number(item.admin_fee))} •{' '}
                            <span className="font-semibold">
                                transfer{' '}
                                {rupiah.format(Number(item.net_amount))}
                            </span>
                        </p>
                        <p className="text-oxford-navy-900/70 text-xs">
                            {item.bank_name} {item.account_number} a.n.{' '}
                            {item.account_name} •{' '}
                            {new Date(item.created_at).toLocaleString('id-ID')}
                        </p>
                        {item.admin_note && (
                            <p className="text-oxford-navy-900/70 text-xs">
                                Catatan: {item.admin_note}
                            </p>
                        )}
                        {item.status === 'pending' && (
                            <AccountSelect
                                label="Ditransfer dari rekening"
                                className="max-w-xs"
                                value={accounts[item.id] ?? null}
                                onChange={(id) =>
                                    setAccounts((prev) => ({
                                        ...prev,
                                        [item.id]: id,
                                    }))
                                }
                            />
                        )}
                        {item.status === 'pending' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={notes[item.id] ?? ''}
                                    onChange={(e) =>
                                        setNotes((prev) => ({
                                            ...prev,
                                            [item.id]: e.target.value,
                                        }))
                                    }
                                    placeholder="Catatan (opsional)"
                                    className="w-full rounded-xl border border-oxford-navy-900/15 bg-white p-2 text-sm outline-none focus:border-forest-moss-500"
                                />
                                <Button
                                    variant="primary"
                                    className="shrink-0"
                                    disabled={busyId === item.id}
                                    onClick={() => process(item, true)}
                                >
                                    Tandai dibayar
                                </Button>
                                <Button
                                    variant="outline2"
                                    className="shrink-0"
                                    disabled={busyId === item.id}
                                    onClick={() => process(item, false)}
                                >
                                    Tolak
                                </Button>
                            </div>
                        )}
                    </div>
                ))
            )}

            <Pagination meta={meta} onPageChange={setPage} />
        </div>
    );
}
