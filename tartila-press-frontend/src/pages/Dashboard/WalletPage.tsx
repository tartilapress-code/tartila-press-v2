import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as walletApi from '@/data/wallet/walletApi';
import { describeApiError } from '@/lib/apiErrors';

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

const formatDate = (iso: string | null) =>
    iso ? dateFormatter.format(new Date(iso)) : '—';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

const fieldClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/40 hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

const STATUS_CLASS: Record<walletApi.WithdrawalStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-forest-moss-100 text-forest-moss-800',
    rejected: 'bg-red-100 text-red-700',
};

type Tab = 'entries' | 'withdrawals';

export default function WalletPage() {
    const [wallet, setWallet] = useState<walletApi.Wallet | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [tab, setTab] = useState<Tab>('entries');
    const [filter, setFilter] = useState<'all' | walletApi.EntryType>('all');

    const load = useCallback(() => {
        return walletApi
            .show()
            .then((response) => setWallet(response.data))
            .catch((caught) => setErrorMessage(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!wallet) {
        return <p className="text-red-600 text-sm">{errorMessage}</p>;
    }

    const { summary, config } = wallet;
    const entries = wallet.entries.filter(
        (entry) => filter === 'all' || entry.type === filter
    );

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Dompet Saya
                </h5>

                <div className="rounded-xl bg-forest-moss-50 p-5">
                    <p className="text-oxford-navy-900/70 text-sm">
                        Saldo saya
                    </p>
                    <p className="text-forest-moss-700 text-3xl font-bold">
                        {rupiah.format(summary.balance)}
                    </p>
                    <p className="text-oxford-navy-900/60 text-xs mt-1">
                        Total pemasukan {rupiah.format(summary.earned)} −
                        ditarik {rupiah.format(summary.withdrawn)} − menunggu
                        diproses {rupiah.format(summary.pending)}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(
                        Object.keys(
                            walletApi.TYPE_LABEL
                        ) as walletApi.EntryType[]
                    ).map((type) => (
                        <div
                            key={type}
                            className="rounded-xl ring-1 ring-forest-moss-100 p-4"
                        >
                            <p className="text-oxford-navy-900/60 text-xs">
                                {walletApi.TYPE_LABEL[type]}
                            </p>
                            <p className="text-oxford-navy-700 text-lg font-bold">
                                {rupiah.format(summary.by_type[type])}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <WithdrawForm
                balance={summary.balance}
                config={config}
                onDone={load}
            />

            <div className={cardClass}>
                <div className="flex flex-row gap-2 border-b border-forest-moss-100 pb-3">
                    {(
                        [
                            ['entries', 'Rincian Pemasukan'],
                            ['withdrawals', 'Riwayat Penarikan'],
                        ] as [Tab, string][]
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:cursor-pointer ${
                                tab === key
                                    ? 'bg-oxford-navy-700 text-white'
                                    : 'text-oxford-navy-700 hover:bg-forest-moss-50'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'entries' ? (
                    <>
                        <select
                            value={filter}
                            onChange={(e) =>
                                setFilter(
                                    e.target.value as
                                        'all' | walletApi.EntryType
                                )
                            }
                            className="self-start rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                        >
                            <option value="all">Semua jenis</option>
                            {(
                                Object.keys(
                                    walletApi.TYPE_LABEL
                                ) as walletApi.EntryType[]
                            ).map((type) => (
                                <option key={type} value={type}>
                                    {walletApi.TYPE_LABEL[type]}
                                </option>
                            ))}
                        </select>

                        {entries.length === 0 ? (
                            <p className="text-oxford-navy-900/60 text-sm">
                                Belum ada pemasukan.
                            </p>
                        ) : (
                            <div className="flex flex-col divide-y divide-forest-moss-100">
                                {entries.map((entry, index) => (
                                    <div
                                        key={`${entry.type}-${index}`}
                                        className="flex flex-row items-start justify-between gap-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-oxford-navy-900 text-sm font-semibold">
                                                {entry.title}
                                            </p>
                                            <p className="text-oxford-navy-900/60 text-xs">
                                                {entry.label} •{' '}
                                                {formatDate(entry.date)}
                                            </p>
                                            {entry.detail && (
                                                <p className="text-oxford-navy-900/60 text-xs">
                                                    {entry.detail}
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-forest-moss-700 font-semibold whitespace-nowrap">
                                            +{rupiah.format(entry.amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : wallet.withdrawals.length === 0 ? (
                    <p className="text-oxford-navy-900/60 text-sm">
                        Belum ada penarikan.
                    </p>
                ) : (
                    <div className="flex flex-col divide-y divide-forest-moss-100">
                        {wallet.withdrawals.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-oxford-navy-900 text-sm font-semibold">
                                        {rupiah.format(Number(item.amount))}{' '}
                                        <span className="text-oxford-navy-900/60 font-normal">
                                            (biaya admin{' '}
                                            {rupiah.format(
                                                Number(item.admin_fee)
                                            )}
                                            , diterima{' '}
                                            {rupiah.format(
                                                Number(item.net_amount)
                                            )}
                                            )
                                        </span>
                                    </p>
                                    <p className="text-oxford-navy-900/60 text-xs">
                                        {formatDate(item.created_at)} •{' '}
                                        {item.bank_name} {item.account_number}{' '}
                                        a.n. {item.account_name}
                                    </p>
                                    {item.admin_note && (
                                        <p className="text-oxford-navy-900/60 text-xs">
                                            Catatan admin: {item.admin_note}
                                        </p>
                                    )}
                                </div>
                                <span
                                    className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status]}`}
                                >
                                    {walletApi.STATUS_LABEL[item.status]}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function WithdrawForm({
    balance,
    config,
    onDone,
}: {
    balance: number;
    config: walletApi.Wallet['config'];
    onDone: () => Promise<unknown>;
}) {
    const [amount, setAmount] = useState<string>('');
    const [bank, setBank] = useState<string>('');
    const [number, setNumber] = useState<string>('');
    const [holder, setHolder] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    const amountNumber = Number(amount) || 0;
    const canSubmit =
        amountNumber >= config.min_amount &&
        amountNumber <= balance &&
        bank.trim() !== '' &&
        number.trim() !== '' &&
        holder.trim() !== '';

    async function handleSubmit() {
        setIsSaving(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await walletApi.withdraw({
                amount: amountNumber,
                bank_name: bank.trim(),
                account_number: number.trim(),
                account_name: holder.trim(),
            });
            setMessage(response.message);
            setAmount('');
            await onDone();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className={cardClass}>
            <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                Tarik saldo
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Jumlah penarikan (Rp)
                    <input
                        className={fieldClass}
                        type="number"
                        min={config.min_amount}
                        max={balance}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Nama bank / e-wallet
                    <input
                        className={fieldClass}
                        value={bank}
                        placeholder="mis. BNI"
                        onChange={(e) => setBank(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Nomor rekening
                    <input
                        className={fieldClass}
                        inputMode="numeric"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Atas nama
                    <input
                        className={fieldClass}
                        value={holder}
                        onChange={(e) => setHolder(e.target.value)}
                    />
                </label>
            </div>
            <p className="text-oxford-navy-900/70 text-xs">
                Biaya admin {rupiah.format(config.admin_fee)} dipotong dari
                jumlah penarikan.
                {amountNumber > config.admin_fee &&
                    ` Yang ditransfer: ${rupiah.format(amountNumber - config.admin_fee)}.`}{' '}
                Minimal penarikan {rupiah.format(config.min_amount)}.
            </p>
            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}
            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSaving || !canSubmit}
            >
                {isSaving ? 'Mengirim...' : 'Ajukan Penarikan'}
            </Button>
        </div>
    );
}
