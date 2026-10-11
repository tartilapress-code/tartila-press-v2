import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as financeApi from '@/data/finance/financeApi';
import { describeApiError } from '@/lib/apiErrors';
import RevenueChart from './RevenueChart';
import { rupiah } from './format';

const MONTHS = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

type Granularity = 'daily' | 'monthly' | 'yearly';

function Card({
    label,
    value,
    hint,
    tone = 'default',
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'default' | 'in' | 'out' | 'hold';
}) {
    const color = {
        default: 'text-oxford-navy-700',
        in: 'text-forest-moss-700',
        out: 'text-red-700',
        hold: 'text-amber-800',
    }[tone];

    return (
        <div className="flex flex-col gap-1 rounded-xl bg-white p-4 ring-1 ring-forest-moss-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/60">
                {label}
            </span>
            <span className={`text-xl font-bold ${color}`}>{value}</span>
            {hint && (
                <span className="text-xs text-oxford-navy-900/60">{hint}</span>
            )}
        </div>
    );
}

/** Ringkasan: total saldo, saldo per rekening, arus kas bulan ini, omzet. */
export default function SummaryTab() {
    const now = new Date();
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [granularity, setGranularity] = useState<Granularity>('daily');
    const [data, setData] = useState<financeApi.FinanceSummary | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const [opening, setOpening] = useState<string>('');
    const [message, setMessage] = useState<string>('');

    function fetchSummary() {
        return financeApi
            .summary(year, month)
            .then((response) => setData(response.data))
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        void fetchSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month]);

    async function saveOpening(id: number) {
        try {
            await financeApi.saveOpeningBalance(id, Number(opening) || 0);
            setEditing(null);
            await fetchSummary();
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    if (!data) {
        return (
            <p className="text-sm text-oxford-navy-900/70">
                {message || 'Memuat...'}
            </p>
        );
    }

    const series = data.revenue[granularity];
    const chartTitle = {
        daily: `Omzet harian · ${MONTHS[month - 1]} ${year}`,
        monthly: `Omzet bulanan · ${year}`,
        yearly: 'Omzet tahunan',
    }[granularity];
    const years = Array.from(
        new Set([
            ...data.revenue.yearly.map((point) => Number(point.label)),
            now.getFullYear(),
        ])
    ).sort((a, b) => b - a);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Bulan
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900"
                    >
                        {MONTHS.map((name, index) => (
                            <option key={name} value={index + 1}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Tahun
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900"
                    >
                        {years.map((each) => (
                            <option key={each} value={each}>
                                {each}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card
                    label="Total saldo"
                    value={rupiah(data.balances.total)}
                    hint="Semua rekening + transaksi tanpa rekening"
                />
                <Card
                    label={`Masuk · ${MONTHS[month - 1]}`}
                    value={rupiah(data.month_totals.in)}
                    tone="in"
                />
                <Card
                    label={`Keluar · ${MONTHS[month - 1]}`}
                    value={rupiah(data.month_totals.out)}
                    tone="out"
                />
                <Card
                    label="Hold (semua waktu)"
                    value={rupiah(data.all_totals.hold)}
                    hint="Sudah dibayar, proses belum selesai"
                    tone="hold"
                />
            </div>

            <section className="flex flex-col gap-3">
                <h6 className="font-semibold text-oxford-navy-900">
                    Saldo per rekening
                </h6>
                <div className="overflow-x-auto rounded-xl ring-1 ring-forest-moss-100">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-forest-moss-50 text-left text-xs uppercase tracking-wide text-oxford-navy-900/70">
                            <tr>
                                <th className="p-3">Rekening</th>
                                <th className="p-3 text-right">Saldo awal</th>
                                <th className="p-3 text-right">Masuk</th>
                                <th className="p-3 text-right">Keluar</th>
                                <th className="p-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {data.balances.accounts.map((account) => (
                                <tr
                                    key={account.id}
                                    className="border-t border-forest-moss-100"
                                >
                                    <td className="p-3">
                                        <p className="font-semibold text-oxford-navy-900">
                                            {account.bank_name} ·{' '}
                                            {account.account_number}
                                        </p>
                                        <p className="text-xs text-oxford-navy-900/60">
                                            a.n. {account.account_holder_name}
                                            {account.is_active
                                                ? ''
                                                : ' · nonaktif'}
                                        </p>
                                    </td>
                                    <td className="p-3 text-right">
                                        {editing === account.id ? (
                                            <span className="inline-flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={opening}
                                                    onChange={(e) =>
                                                        setOpening(
                                                            e.target.value
                                                        )
                                                    }
                                                    aria-label={`Saldo awal ${account.bank_name}`}
                                                    className="w-32 rounded-md border border-oxford-navy-900/15 px-2 py-1 text-right text-sm"
                                                />
                                                <Button
                                                    variant="primary"
                                                    className="px-2 py-1 text-xs"
                                                    onClick={() =>
                                                        saveOpening(account.id)
                                                    }
                                                >
                                                    Simpan
                                                </Button>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(account.id);
                                                    setOpening(
                                                        String(
                                                            account.opening_balance
                                                        )
                                                    );
                                                }}
                                                className="text-oxford-navy-900 underline decoration-dotted underline-offset-2 hover:text-forest-moss-700"
                                                title="Ubah saldo awal"
                                            >
                                                {rupiah(
                                                    account.opening_balance
                                                )}
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-3 text-right text-forest-moss-700">
                                        {rupiah(account.in)}
                                    </td>
                                    <td className="p-3 text-right text-red-700">
                                        {rupiah(account.out)}
                                    </td>
                                    <td className="p-3 text-right font-bold text-oxford-navy-700">
                                        {rupiah(account.balance)}
                                    </td>
                                </tr>
                            ))}
                            {data.balances.unassigned.count > 0 && (
                                <tr className="border-t border-forest-moss-100 bg-amber-50/60">
                                    <td className="p-3">
                                        <p className="font-semibold text-amber-900">
                                            Belum ditentukan rekeningnya
                                        </p>
                                        <p className="text-xs text-amber-900/80">
                                            {data.balances.unassigned.count}{' '}
                                            transaksi — tentukan di tab
                                            Transaksi.
                                        </p>
                                    </td>
                                    <td className="p-3 text-right">-</td>
                                    <td className="p-3 text-right text-forest-moss-700">
                                        {rupiah(data.balances.unassigned.in)}
                                    </td>
                                    <td className="p-3 text-right text-red-700">
                                        {rupiah(data.balances.unassigned.out)}
                                    </td>
                                    <td className="p-3 text-right font-bold text-amber-900">
                                        {rupiah(
                                            data.balances.unassigned.balance
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="border-t-2 border-forest-moss-200 bg-forest-moss-50">
                            <tr>
                                <th
                                    scope="row"
                                    colSpan={4}
                                    className="p-3 text-left"
                                >
                                    Total saldo
                                </th>
                                <td className="p-3 text-right text-base font-bold text-oxford-navy-700">
                                    {rupiah(data.balances.total)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <section className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-forest-moss-100">
                <div
                    role="tablist"
                    aria-label="Rentang grafik omzet"
                    className="flex flex-wrap gap-2"
                >
                    {(
                        [
                            ['daily', 'Harian'],
                            ['monthly', 'Bulanan'],
                            ['yearly', 'Tahunan'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={granularity === key}
                            onClick={() => setGranularity(key)}
                            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                                granularity === key
                                    ? 'bg-oxford-navy-700 text-white'
                                    : 'bg-forest-moss-50 text-oxford-navy-900 hover:bg-forest-moss-100'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <RevenueChart points={series} title={chartTitle} />
                <p className="text-xs text-oxford-navy-900/60">
                    Omzet = total pesanan yang sudah dibayar (dikonfirmasi
                    admin), menurut tanggal konfirmasi pembayaran.
                </p>
            </section>

            {message && <p className="text-sm text-red-700">{message}</p>}
        </div>
    );
}
