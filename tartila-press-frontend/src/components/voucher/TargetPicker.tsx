import { useState } from 'react';
import type {
    DiscountRow,
    TargetType,
    VoucherTarget,
} from '@/data/voucher/voucherApi';

const GROUPS: { type: Exclude<TargetType, 'all'>; label: string }[] = [
    { type: 'package', label: 'Semua paket' },
    { type: 'custom_item', label: 'Semua layanan' },
    { type: 'book', label: 'Semua buku / Book Chapter' },
];

const checkboxRow =
    'flex flex-row items-center gap-2 text-sm text-oxford-navy-900';

// Pemilih produk target voucher / hak voucher: semua produk, semua dari satu
// jenis, atau produk tertentu (paket, layanan, buku, Book Chapter).
export default function TargetPicker({
    items,
    value,
    onChange,
}: {
    items: DiscountRow[];
    value: VoucherTarget[];
    onChange: (next: VoucherTarget[]) => void;
}) {
    const [query, setQuery] = useState<string>('');

    const hasAll = value.some((target) => target.type === 'all');

    const has = (type: TargetType, id: number | null) =>
        value.some((target) => target.type === type && target.id === id);

    function toggle(type: TargetType, id: number | null) {
        if (has(type, id)) {
            onChange(
                value.filter(
                    (target) => !(target.type === type && target.id === id)
                )
            );
            return;
        }

        onChange([...value, { type, id }]);
    }

    const visible = items.filter(
        (item) =>
            item.is_active &&
            item.name.toLowerCase().includes(query.trim().toLowerCase())
    );

    return (
        <div className="flex flex-col gap-3 rounded-xl ring-1 ring-forest-moss-100 p-3">
            <label className={checkboxRow}>
                <input
                    type="checkbox"
                    checked={hasAll}
                    onChange={() =>
                        onChange(hasAll ? [] : [{ type: 'all', id: null }])
                    }
                />
                <span className="font-semibold">Semua produk</span>
            </label>

            {!hasAll && (
                <>
                    <div className="flex flex-row flex-wrap gap-x-5 gap-y-1">
                        {GROUPS.map((group) => (
                            <label key={group.type} className={checkboxRow}>
                                <input
                                    type="checkbox"
                                    checked={has(group.type, null)}
                                    onChange={() => toggle(group.type, null)}
                                />
                                {group.label}
                            </label>
                        ))}
                    </div>

                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari produk tertentu..."
                        className="w-full rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm outline-none focus:border-forest-moss-500"
                    />

                    <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
                        {visible.map((item) => (
                            <label
                                key={`${item.type}-${item.id}`}
                                className={checkboxRow}
                            >
                                <input
                                    type="checkbox"
                                    checked={
                                        has(item.type, item.id) ||
                                        has(item.type, null)
                                    }
                                    disabled={has(item.type, null)}
                                    onChange={() => toggle(item.type, item.id)}
                                />
                                <span className="min-w-0 truncate">
                                    <span className="text-oxford-navy-900/55">
                                        {item.kind_label}:
                                    </span>{' '}
                                    {item.name}
                                </span>
                            </label>
                        ))}
                        {visible.length === 0 && (
                            <p className="text-oxford-navy-900/60 text-sm">
                                Tidak ada produk yang cocok.
                            </p>
                        )}
                    </div>
                </>
            )}

            <p className="text-oxford-navy-900/70 text-xs">
                {value.length === 0
                    ? 'Belum ada produk dipilih.'
                    : hasAll
                      ? 'Berlaku untuk semua produk.'
                      : `${value.length} pilihan dipilih.`}
            </p>
        </div>
    );
}
