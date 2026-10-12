import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as financeApi from '@/data/finance/financeApi';
import { describeApiError } from '@/lib/apiErrors';
import { formatDate, rupiah, STATUS_LABELS, statusClass } from './format';

// Tanggal lokal (WIB), bukan UTC dari toISOString().
const today = () => new Date().toLocaleDateString('en-CA');

const EMPTY_FORM: financeApi.ManualTransactionPayload = {
    transaction_date: today(),
    direction: 'out',
    category: 'operational',
    payment_method_id: null,
    amount: 0,
    status: 'completed',
    description: '',
};

const inputClass =
    'rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

/** Arus kas: masuk/keluar, jenis, status, rekening; transaksi manual. */
export default function TransactionsTab() {
    const [filters, setFilters] = useState<financeApi.LedgerFilters>({});
    const [data, setData] = useState<financeApi.LedgerResponse | null>(null);
    const [form, setForm] =
        useState<financeApi.ManualTransactionPayload | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    function fetchLedger(next: financeApi.LedgerFilters) {
        return financeApi
            .transactions(next)
            .then((response) => setData(response.data))
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        void fetchLedger(filters);
    }, [filters]);

    function setFilter(key: keyof financeApi.LedgerFilters, value: string) {
        setFilters({ ...filters, [key]: value });
    }

    async function assign(
        entry: financeApi.LedgerEntry,
        accountId: number | null
    ) {
        try {
            await financeApi.assignAccount(
                entry.source as 'order' | 'withdrawal',
                entry.source_id,
                accountId
            );
            await fetchLedger(filters);
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    async function save() {
        if (!form) return;

        setIsSaving(true);
        setMessage('');

        try {
            if (editingId) {
                await financeApi.updateTransaction(editingId, form);
            } else {
                await financeApi.createTransaction(form);
            }

            setForm(null);
            setEditingId(null);
            await fetchLedger(filters);
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setIsSaving(false);
        }
    }

    async function remove(entry: financeApi.LedgerEntry) {
        if (!window.confirm(`Hapus transaksi "${entry.description}"?`)) return;

        try {
            await financeApi.deleteTransaction(entry.source_id);
            await fetchLedger(filters);
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    function edit(entry: financeApi.LedgerEntry) {
        setEditingId(entry.source_id);
        setForm({
            transaction_date: entry.date.slice(0, 10),
            direction: entry.direction,
            category: entry.type,
            payment_method_id: entry.account?.id ?? null,
            amount: entry.amount,
            status: entry.status,
            description: entry.description,
        });
    }

    const accounts = data?.accounts ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-forest-moss-100 sm:grid-cols-3 lg:grid-cols-6">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Dari
                    <input
                        type="date"
                        value={filters.from ?? ''}
                        onChange={(e) => setFilter('from', e.target.value)}
                        className={inputClass}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Sampai
                    <input
                        type="date"
                        value={filters.to ?? ''}
                        onChange={(e) => setFilter('to', e.target.value)}
                        className={inputClass}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Arus
                    <select
                        value={filters.direction ?? ''}
                        onChange={(e) => setFilter('direction', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Masuk & keluar</option>
                        <option value="in">Masuk</option>
                        <option value="out">Keluar</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Jenis transaksi
                    <select
                        value={filters.type ?? ''}
                        onChange={(e) => setFilter('type', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Semua jenis</option>
                        {Object.entries(data?.types ?? {}).map(
                            ([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            )
                        )}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Status
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => setFilter('status', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Semua status</option>
                        <option value="completed">Selesai</option>
                        <option value="hold">
                            Hold (sudah bayar, proses belum selesai)
                        </option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Rekening
                    <select
                        value={filters.account ?? ''}
                        onChange={(e) => setFilter('account', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Semua rekening</option>
                        <option value="none">Belum ditentukan</option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {data && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-oxford-navy-900/80">
                        {data.totals.count} transaksi · Masuk{' '}
                        <strong className="text-forest-moss-700">
                            {rupiah(data.totals.in)}
                        </strong>{' '}
                        · Keluar{' '}
                        <strong className="text-red-700">
                            {rupiah(data.totals.out)}
                        </strong>{' '}
                        · Bersih <strong>{rupiah(data.totals.net)}</strong> ·
                        Hold{' '}
                        <strong className="text-amber-800">
                            {rupiah(data.totals.hold)}
                        </strong>
                    </p>
                    {!form && (
                        <Button
                            variant="primary"
                            onClick={() => {
                                setEditingId(null);
                                setForm({
                                    ...EMPTY_FORM,
                                    transaction_date: today(),
                                });
                            }}
                        >
                            Catat Transaksi
                        </Button>
                    )}
                </div>
            )}

            {form && (
                <div className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-forest-moss-200 sm:grid-cols-2 lg:grid-cols-3">
                    <p className="font-semibold text-oxford-navy-900 sm:col-span-2 lg:col-span-3">
                        {editingId
                            ? 'Ubah transaksi'
                            : 'Catat transaksi manual'}
                    </p>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Tanggal
                        <input
                            type="date"
                            value={form.transaction_date}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    transaction_date: e.target.value,
                                })
                            }
                            className={inputClass}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Arus
                        <select
                            value={form.direction}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    direction: e.target.value as 'in' | 'out',
                                    category:
                                        e.target.value === 'in'
                                            ? 'other_income'
                                            : 'operational',
                                })
                            }
                            className={inputClass}
                        >
                            <option value="out">Keluar</option>
                            <option value="in">Masuk</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Jenis
                        <select
                            value={form.category}
                            onChange={(e) =>
                                setForm({ ...form, category: e.target.value })
                            }
                            className={inputClass}
                        >
                            {Object.entries(data?.manual_categories ?? {}).map(
                                ([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Rekening
                        <select
                            value={form.payment_method_id ?? ''}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    payment_method_id:
                                        Number(e.target.value) || null,
                                })
                            }
                            className={inputClass}
                        >
                            <option value="">Belum ditentukan</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Jumlah (Rp)
                        <input
                            type="number"
                            min={1}
                            value={form.amount || ''}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    amount: Number(e.target.value),
                                })
                            }
                            className={inputClass}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Status
                        <select
                            value={form.status}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    status: e.target.value as
                                        'completed' | 'hold',
                                })
                            }
                            className={inputClass}
                        >
                            <option value="completed">Selesai</option>
                            <option value="hold">Hold</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70 sm:col-span-2 lg:col-span-3">
                        Keterangan
                        <input
                            type="text"
                            maxLength={500}
                            value={form.description}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    description: e.target.value,
                                })
                            }
                            className={inputClass}
                        />
                    </label>
                    <div className="flex flex-row gap-2 sm:col-span-2 lg:col-span-3">
                        <Button
                            variant="primary"
                            disabled={
                                isSaving ||
                                form.amount <= 0 ||
                                form.description.trim() === ''
                            }
                            onClick={save}
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => {
                                setForm(null);
                                setEditingId(null);
                            }}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}

            {message && <p className="text-sm text-red-700">{message}</p>}

            <div className="overflow-x-auto rounded-xl ring-1 ring-forest-moss-100">
                <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-forest-moss-50 text-left text-xs uppercase tracking-wide text-oxford-navy-900/70">
                        <tr>
                            <th className="p-3">Tanggal</th>
                            <th className="p-3">Jenis</th>
                            <th className="p-3">Keterangan</th>
                            <th className="p-3">Rekening</th>
                            <th className="p-3 text-right">Jumlah</th>
                            <th className="p-3">Status</th>
                            <th className="p-3" />
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {data?.items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="p-6 text-center text-oxford-navy-900/60"
                                >
                                    Tidak ada transaksi untuk filter ini.
                                </td>
                            </tr>
                        )}
                        {data?.items.map((entry) => (
                            <tr
                                key={entry.key}
                                className="border-t border-forest-moss-100 align-top"
                            >
                                <td className="whitespace-nowrap p-3">
                                    {formatDate(entry.date)}
                                </td>
                                <td className="p-3">
                                    <span className="font-semibold text-oxford-navy-900">
                                        {entry.type_label}
                                    </span>
                                </td>
                                <td className="p-3 text-oxford-navy-900/80">
                                    {entry.description}
                                    {entry.party && (
                                        <span className="block text-xs text-oxford-navy-900/60">
                                            {entry.party}
                                        </span>
                                    )}
                                </td>
                                <td className="p-3">
                                    {entry.source === 'manual' ||
                                    entry.source === 'reader_day' ? (
                                        (entry.account?.name ?? (
                                            <span className="text-amber-800">
                                                Belum ditentukan
                                            </span>
                                        ))
                                    ) : (
                                        <select
                                            value={entry.account?.id ?? ''}
                                            onChange={(e) =>
                                                assign(
                                                    entry,
                                                    Number(e.target.value) ||
                                                        null
                                                )
                                            }
                                            aria-label={`Rekening ${entry.description}`}
                                            className={`${inputClass} ${entry.account ? '' : 'border-amber-400 bg-amber-50'}`}
                                        >
                                            <option value="">
                                                Belum ditentukan
                                            </option>
                                            {accounts.map((account) => (
                                                <option
                                                    key={account.id}
                                                    value={account.id}
                                                >
                                                    {account.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </td>
                                <td
                                    className={`whitespace-nowrap p-3 text-right font-semibold ${entry.direction === 'in' ? 'text-forest-moss-700' : 'text-red-700'}`}
                                >
                                    {entry.direction === 'in' ? '+' : '−'}{' '}
                                    {rupiah(entry.amount)}
                                </td>
                                <td className="p-3">
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(entry.status)}`}
                                    >
                                        {STATUS_LABELS[entry.status]}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap p-3 text-right">
                                    {entry.source === 'manual' && (
                                        <span className="flex justify-end gap-3 text-xs font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => edit(entry)}
                                                className="text-forest-moss-700 hover:underline"
                                            >
                                                Ubah
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(entry)}
                                                className="text-red-700 hover:underline"
                                            >
                                                Hapus
                                            </button>
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
