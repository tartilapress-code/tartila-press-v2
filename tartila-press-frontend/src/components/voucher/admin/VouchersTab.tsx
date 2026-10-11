import { useMemo, useState } from 'react';
import Button from '@/components/Button/Button';
import TargetPicker from '@/components/voucher/TargetPicker';
import StatusBadge from '@/components/voucher/StatusBadge';
import {
    formatDateTime,
    percent,
    rupiah,
    targetsText,
} from '@/components/voucher/voucherFormat';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';
import { toIso } from '@/lib/dateInput';

const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: 'all', label: 'Semua status' },
    ...Object.entries(voucherApi.STATUS_LABEL).map(([value, label]) => ({
        value,
        label,
    })),
];

const SOURCE_FILTERS: { value: string; label: string }[] = [
    { value: 'all', label: 'Semua sumber' },
    ...Object.entries(voucherApi.SOURCE_LABEL).map(([value, label]) => ({
        value,
        label,
    })),
];

const fieldClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/40 hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';
const selectClass =
    'rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

export default function VouchersTab({
    vouchers,
    items,
    onChanged,
}: {
    vouchers: voucherApi.Voucher[];
    items: voucherApi.DiscountRow[];
    onChanged: () => Promise<unknown>;
}) {
    const [status, setStatus] = useState<string>('all');
    const [source, setSource] = useState<string>('all');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);

    // form
    const [name, setName] = useState<string>('');
    const [code, setCode] = useState<string>('');
    const [targets, setTargets] = useState<voucherApi.VoucherTarget[]>([]);
    const [discount, setDiscount] = useState<string>('');
    const [maxUses, setMaxUses] = useState<string>('');
    const [startsAt, setStartsAt] = useState<string>('');
    const [expiresAt, setExpiresAt] = useState<string>('');

    const visible = useMemo(
        () =>
            vouchers.filter(
                (voucher) =>
                    (status === 'all' || voucher.status === status) &&
                    (source === 'all' || voucher.source === source)
            ),
        [vouchers, status, source]
    );

    // Voucher royalti tidak bisa direset admin.
    const resettable = (voucher: voucherApi.Voucher) =>
        voucher.source !== 'royalty' && voucher.reset_at === null;

    const counts = useMemo(() => {
        const result: Record<string, number> = {};

        vouchers.forEach((voucher) => {
            result[voucher.status] = (result[voucher.status] ?? 0) + 1;
        });

        return result;
    }, [vouchers]);

    async function run(action: () => Promise<{ message?: string }>) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await action();
            setMessage(response.message ?? 'Berhasil.');
            setSelected(new Set());
            await onChanged();

            return true;
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));

            return false;
        } finally {
            setIsBusy(false);
        }
    }

    async function handleCreate() {
        const ok = await run(() =>
            voucherApi.adminCreateVoucher({
                name: name.trim() || null,
                code: code.trim() || null,
                targets,
                discount_percent: Number(discount),
                max_uses: maxUses ? Number(maxUses) : null,
                starts_at: toIso(startsAt),
                expires_at: toIso(expiresAt),
            })
        );

        if (ok) {
            setName('');
            setCode('');
            setTargets([]);
            setDiscount('');
            setMaxUses('');
            setStartsAt('');
            setExpiresAt('');
        }
    }

    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }

    const resettableCount = vouchers.filter(resettable).length;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-xl ring-1 ring-forest-moss-100 p-4">
                <p className="text-oxford-navy-900 font-semibold">
                    Buat voucher baru (ditanggung perusahaan)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Nama voucher (opsional)
                        <input
                            className={fieldClass}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Kode (kosongkan untuk acak)
                        <input
                            className={`${fieldClass} uppercase placeholder:normal-case`}
                            value={code}
                            maxLength={20}
                            onChange={(e) => setCode(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Diskon (%)
                        <input
                            className={fieldClass}
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Maksimal pemakaian (kosong = tanpa batas)
                        <input
                            className={fieldClass}
                            type="number"
                            min={1}
                            value={maxUses}
                            onChange={(e) => setMaxUses(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Mulai berlaku (opsional)
                        <input
                            className={fieldClass}
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => setStartsAt(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Berakhir (opsional)
                        <input
                            className={fieldClass}
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                        />
                    </label>
                </div>
                <p className="text-oxford-navy-900 text-sm font-medium">
                    Berlaku untuk
                </p>
                <TargetPicker
                    items={items}
                    value={targets}
                    onChange={setTargets}
                />
                <Button
                    variant="primary"
                    className="self-start"
                    disabled={isBusy || targets.length === 0 || !discount}
                    onClick={handleCreate}
                >
                    Buat Voucher
                </Button>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex flex-row flex-wrap items-center gap-2">
                    <select
                        className={selectClass}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        {STATUS_FILTERS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                                {option.value !== 'all' &&
                                    ` (${counts[option.value] ?? 0})`}
                            </option>
                        ))}
                    </select>
                    <select
                        className={selectClass}
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                    >
                        {SOURCE_FILTERS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <Button
                        variant="outline2"
                        className="sm:ml-auto"
                        disabled={isBusy || selected.size === 0}
                        onClick={() =>
                            run(() =>
                                voucherApi.adminResetVouchers({
                                    ids: [...selected],
                                })
                            )
                        }
                    >
                        Reset terpilih ({selected.size})
                    </Button>
                    <Button
                        variant="outline2"
                        disabled={isBusy || resettableCount === 0}
                        onClick={() => {
                            if (
                                window.confirm(
                                    'Reset SEMUA voucher (kecuali voucher dari royalti penulis/editor)? Voucher yang direset tidak bisa dipakai lagi.'
                                )
                            ) {
                                run(() =>
                                    voucherApi.adminResetVouchers({ all: true })
                                );
                            }
                        }}
                    >
                        Reset semua voucher
                    </Button>
                </div>

                {message && (
                    <p
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}

                {visible.length === 0 ? (
                    <p className="text-oxford-navy-900/60 text-sm">
                        Tidak ada voucher.
                    </p>
                ) : (
                    visible.map((voucher) => (
                        <div
                            key={voucher.id}
                            className="flex flex-row items-start gap-3 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3"
                        >
                            <input
                                type="checkbox"
                                className="mt-1"
                                aria-label={`Pilih ${voucher.code}`}
                                disabled={!resettable(voucher)}
                                checked={selected.has(voucher.id)}
                                onChange={() => toggle(voucher.id)}
                            />
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex flex-row flex-wrap items-center gap-2">
                                    <span className="font-mono text-oxford-navy-900 font-bold tracking-wide">
                                        {voucher.code}
                                    </span>
                                    <StatusBadge status={voucher.status} />
                                    <span className="text-oxford-navy-900/60 text-xs">
                                        {
                                            voucherApi.SOURCE_LABEL[
                                                voucher.source
                                            ]
                                        }
                                        {voucher.user_name &&
                                            ` • ${voucher.user_name}`}
                                    </span>
                                </div>
                                {voucher.name && (
                                    <p className="text-oxford-navy-900 text-sm">
                                        {voucher.name}
                                    </p>
                                )}
                                <p className="text-oxford-navy-900/70 text-xs">
                                    Diskon {percent(voucher.discount_percent)}
                                    {voucher.fee_percent > 0 &&
                                        ` • Fee pembuat ${percent(voucher.fee_percent)}`}{' '}
                                    • {targetsText(voucher.targets)}
                                </p>
                                <p className="text-oxford-navy-900/70 text-xs">
                                    Dipakai {voucher.uses}
                                    {voucher.max_uses !== null &&
                                        `/${voucher.max_uses}`}
                                    × ({voucher.completed_uses} selesai) •
                                    potongan{' '}
                                    {rupiah.format(voucher.discount_given)}
                                    {voucher.fee_percent > 0 &&
                                        ` • fee ${rupiah.format(voucher.fee_earned)}`}
                                </p>
                                <p className="text-oxford-navy-900/60 text-xs">
                                    {voucher.starts_at
                                        ? `Mulai ${formatDateTime(voucher.starts_at)}`
                                        : 'Langsung berlaku'}
                                    {' • '}
                                    {voucher.expires_at
                                        ? `berakhir ${formatDateTime(voucher.expires_at)}`
                                        : 'tanpa batas akhir'}
                                    {voucher.source === 'royalty' &&
                                        ' • tidak bisa direset admin'}
                                </p>
                            </div>
                            {voucher.reset_at === null &&
                                voucher.source !== 'royalty' && (
                                    <Button
                                        variant="outline2"
                                        className="shrink-0"
                                        disabled={isBusy}
                                        onClick={() =>
                                            run(() =>
                                                voucherApi.adminUpdateVoucher(
                                                    voucher.id,
                                                    {
                                                        is_active:
                                                            !voucher.is_active,
                                                    }
                                                )
                                            )
                                        }
                                    >
                                        {voucher.is_active
                                            ? 'Matikan'
                                            : 'Aktifkan'}
                                    </Button>
                                )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
