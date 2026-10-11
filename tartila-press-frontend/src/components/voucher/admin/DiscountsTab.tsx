import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/voucher/StatusBadge';
import { rupiah } from '@/components/voucher/voucherFormat';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';
import type { PageMeta } from '@/lib/pagination';

const KIND_FILTERS = [
    { value: 'all', label: 'Semua jenis' },
    { value: 'package', label: 'Paket' },
    { value: 'custom_item', label: 'Layanan' },
    { value: 'book', label: 'Buku & Book Chapter' },
];

const STATUS_FILTERS = [
    { value: 'all', label: 'Semua status' },
    { value: 'active', label: 'Sedang diskon' },
    { value: 'none', label: 'Tanpa diskon' },
];

const selectClass =
    'rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const rowKey = (row: Pick<voucherApi.DiscountRow, 'type' | 'id'>) =>
    `${row.type}-${row.id}`;

// "book-12" -> { type: 'book', id: 12 } (pilihan tersimpan lintas halaman).
const fromKey = (key: string) => {
    const at = key.lastIndexOf('-');

    return {
        type: key.slice(0, at) as voucherApi.DiscountRow['type'],
        id: Number(key.slice(at + 1)),
    };
};

export default function DiscountsTab({
    onChanged,
}: {
    onChanged: () => Promise<unknown>;
}) {
    const [kind, setKind] = useState<string>('all');
    const [status, setStatus] = useState<string>('all');
    const [query, setQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [visible, setVisible] = useState<voucherApi.DiscountRow[]>([]);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [activeCount, setActiveCount] = useState<number>(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [percentInput, setPercentInput] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);

    // Jenis, status, pencarian & halaman dikerjakan server.
    const load = useCallback(
        () =>
            voucherApi
                .adminPageDiscounts({
                    kind: kind === 'all' ? '' : kind,
                    status: status === 'all' ? '' : status,
                    search: query.trim(),
                    page,
                })
                .then((response) => {
                    setVisible(response.data);
                    setMeta(response.meta ?? null);
                    setActiveCount(response.meta?.active_count ?? 0);
                })
                .catch((caught) => {
                    setIsError(true);
                    setMessage(describeApiError(caught));
                }),
        [kind, status, query, page]
    );

    useEffect(() => {
        const timeout = setTimeout(() => void load(), 300);

        return () => clearTimeout(timeout);
    }, [load]);

    function changeFilter(apply: () => void) {
        apply();
        setPage(1);
    }

    const selectedItems = [...selected].map(fromKey);

    function toggle(row: voucherApi.DiscountRow) {
        setSelected((prev) => {
            const next = new Set(prev);

            if (next.has(rowKey(row))) {
                next.delete(rowKey(row));
            } else {
                next.add(rowKey(row));
            }

            return next;
        });
    }

    function toggleAllVisible() {
        const allSelected = visible.every((row) => selected.has(rowKey(row)));

        setSelected((prev) => {
            const next = new Set(prev);

            visible.forEach((row) =>
                allSelected ? next.delete(rowKey(row)) : next.add(rowKey(row))
            );

            return next;
        });
    }

    async function run(action: () => Promise<{ message?: string }>) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await action();
            setMessage(response.message ?? 'Berhasil.');
            setSelected(new Set());
            await Promise.all([load(), onChanged()]);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    const percentNumber = Number(percentInput);
    const percentValid =
        percentInput !== '' &&
        Number.isInteger(percentNumber) &&
        percentNumber >= 0 &&
        percentNumber <= 100;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-oxford-navy-900/80 text-sm">
                Diskon produk dipotong dari harga asli dan ditanggung
                perusahaan. {activeCount} produk sedang diskon. Produk milik
                editor (Book Chapter buatan editor) tidak ikut berubah saat
                diskon diatur atau direset dari sini.
            </p>

            <div className="flex flex-row flex-wrap items-center gap-2">
                <select
                    className={selectClass}
                    value={kind}
                    onChange={(e) =>
                        changeFilter(() => setKind(e.target.value))
                    }
                >
                    {KIND_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    className={selectClass}
                    value={status}
                    onChange={(e) =>
                        changeFilter(() => setStatus(e.target.value))
                    }
                >
                    {STATUS_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <input
                    type="search"
                    value={query}
                    onChange={(e) =>
                        changeFilter(() => setQuery(e.target.value))
                    }
                    placeholder="Cari produk..."
                    className={`${selectClass} min-w-48 flex-1`}
                />
            </div>

            <div className="flex flex-row flex-wrap items-end gap-2 rounded-xl bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Diskon (%) untuk {selectedItems.length} produk terpilih
                    <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={percentInput}
                        onChange={(e) => setPercentInput(e.target.value)}
                        className={`${selectClass} w-32`}
                    />
                </label>
                <Button
                    variant="primary"
                    disabled={
                        isBusy || selectedItems.length === 0 || !percentValid
                    }
                    onClick={() =>
                        run(() =>
                            voucherApi.adminApplyDiscount(
                                selectedItems,
                                percentNumber
                            )
                        )
                    }
                >
                    Terapkan diskon
                </Button>
                <Button
                    variant="outline2"
                    disabled={isBusy || selectedItems.length === 0}
                    onClick={() =>
                        run(() =>
                            voucherApi.adminResetDiscounts({
                                items: selectedItems,
                            })
                        )
                    }
                >
                    Reset terpilih
                </Button>
                <Button
                    variant="outline2"
                    className="sm:ml-auto"
                    disabled={isBusy || activeCount === 0}
                    onClick={() => {
                        if (
                            window.confirm(
                                'Reset SEMUA diskon produk (kecuali milik editor)?'
                            )
                        ) {
                            run(() =>
                                voucherApi.adminResetDiscounts({ all: true })
                            );
                        }
                    }}
                >
                    Reset semua diskon
                </Button>
            </div>

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-oxford-navy-900/70 border-b border-forest-moss-100">
                            <th className="py-2 pr-2 w-8">
                                <input
                                    type="checkbox"
                                    aria-label="Pilih semua yang tampil"
                                    checked={
                                        visible.length > 0 &&
                                        visible.every((row) =>
                                            selected.has(rowKey(row))
                                        )
                                    }
                                    onChange={toggleAllVisible}
                                />
                            </th>
                            <th className="py-2 pr-3">Produk</th>
                            <th className="py-2 pr-3">Harga</th>
                            <th className="py-2 pr-3">Diskon</th>
                            <th className="py-2 pr-3">Harga akhir</th>
                            <th className="py-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row) => (
                            <tr
                                key={rowKey(row)}
                                className="border-b border-forest-moss-50 align-top"
                            >
                                <td className="py-2 pr-2">
                                    <input
                                        type="checkbox"
                                        aria-label={`Pilih ${row.name}`}
                                        checked={selected.has(rowKey(row))}
                                        onChange={() => toggle(row)}
                                    />
                                </td>
                                <td className="py-2 pr-3">
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {row.name}
                                    </p>
                                    <p className="text-oxford-navy-900/60 text-xs">
                                        {row.kind_label}
                                        {row.editor_owned && ' • milik editor'}
                                        {!row.is_active && ' • nonaktif'}
                                    </p>
                                </td>
                                <td className="py-2 pr-3 whitespace-nowrap">
                                    {rupiah.format(row.price)}
                                </td>
                                <td className="py-2 pr-3">{row.discount}%</td>
                                <td className="py-2 pr-3 whitespace-nowrap">
                                    {rupiah.format(row.final_price)}
                                </td>
                                <td className="py-2">
                                    <StatusBadge
                                        status={
                                            row.status === 'active'
                                                ? 'active'
                                                : 'none'
                                        }
                                        label={
                                            row.status === 'active'
                                                ? 'Sedang diskon'
                                                : 'Tanpa diskon'
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {visible.length === 0 && (
                    <p className="text-oxford-navy-900/60 text-sm py-4">
                        Tidak ada produk yang cocok.
                    </p>
                )}
            </div>

            <Pagination meta={meta} onPageChange={setPage} />
        </div>
    );
}
