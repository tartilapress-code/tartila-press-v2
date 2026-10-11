import { useState } from 'react';
import Button from '@/components/Button/Button';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';
import StatusBadge from './StatusBadge';
import { formatDate, percent, rupiah } from './voucherFormat';

// Form kecil untuk membuat satu kode voucher: kode (opsional), diskon untuk
// pembeli, dan (kalau ada kolam dari admin) fee untuk pembuatnya.
export function CreateVoucherForm({
    maxPercent,
    withFee,
    disabled,
    onSubmit,
}: {
    maxPercent: number;
    withFee: boolean;
    disabled?: boolean;
    onSubmit: (payload: {
        code?: string;
        discount_percent: number;
        fee_percent?: number;
    }) => Promise<void>;
}) {
    const [code, setCode] = useState<string>('');
    const [discount, setDiscount] = useState<string>('');
    const [fee, setFee] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const discountNumber = Number(discount) || 0;
    const feeNumber = Number(fee) || 0;
    const remaining = Math.max(0, maxPercent - discountNumber);

    async function handleSubmit() {
        setIsSaving(true);
        setError('');

        try {
            await onSubmit({
                code: code.trim() || undefined,
                discount_percent: discountNumber,
                fee_percent: withFee ? feeNumber : undefined,
            });
            setCode('');
            setDiscount('');
            setFee('');
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setIsSaving(false);
        }
    }

    const fieldClass =
        'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/40 hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 ring-1 ring-forest-moss-100 p-4">
            <p className="text-oxford-navy-900 text-sm font-semibold">
                Buat voucher baru
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Kode (kosongkan untuk acak)
                    <input
                        className={`${fieldClass} uppercase placeholder:normal-case`}
                        value={code}
                        maxLength={20}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="mis. HEMATBUKU"
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                    Diskon pembeli (%)
                    <input
                        className={fieldClass}
                        type="number"
                        min={0}
                        max={maxPercent}
                        step="0.5"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                    />
                </label>
                {withFee && (
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Fee untuk Anda (%)
                        <input
                            className={fieldClass}
                            type="number"
                            min={0}
                            max={remaining}
                            step="0.5"
                            value={fee}
                            onChange={(e) => setFee(e.target.value)}
                        />
                    </label>
                )}
            </div>
            <p className="text-xs text-oxford-navy-900/70">
                {withFee
                    ? `Diskon + fee maksimal ${percent(maxPercent)}. Sisa kolam: ${percent(Math.max(0, maxPercent - discountNumber - feeNumber))}.`
                    : `Diskon maksimal ${percent(maxPercent)} (sebesar royalti Anda); nilainya dipotong dari royalti Anda tiap voucher terpakai.`}
            </p>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={disabled || isSaving || discountNumber <= 0}
            >
                {isSaving ? 'Membuat...' : 'Buat Voucher'}
            </Button>
        </div>
    );
}

export function VoucherRows({
    vouchers,
    onToggle,
}: {
    vouchers: voucherApi.Voucher[];
    onToggle: (voucher: voucherApi.Voucher) => void;
}) {
    if (vouchers.length === 0) {
        return (
            <p className="text-oxford-navy-900/60 text-sm">
                Belum ada voucher.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {vouchers.map((voucher) => {
                const canToggle =
                    voucher.reset_at === null &&
                    voucher.status !== 'expired' &&
                    voucher.status !== 'scheduled';

                return (
                    <div
                        key={voucher.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-white ring-1 ring-forest-moss-100 p-3"
                    >
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex flex-row flex-wrap items-center gap-2">
                                <span className="font-mono text-oxford-navy-900 font-bold tracking-wide">
                                    {voucher.code}
                                </span>
                                <StatusBadge status={voucher.status} />
                            </div>
                            <p className="text-oxford-navy-900/70 text-xs">
                                Diskon {percent(voucher.discount_percent)}
                                {voucher.fee_percent > 0 &&
                                    ` • Fee ${percent(voucher.fee_percent)}`}
                                {voucher.expires_at &&
                                    ` • berlaku s.d. ${formatDate(voucher.expires_at)}`}
                            </p>
                            <p className="text-oxford-navy-900/70 text-xs">
                                Dipakai {voucher.uses}× (
                                {voucher.completed_uses} selesai)
                                {voucher.fee_percent > 0 &&
                                    ` • Fee masuk ${rupiah.format(voucher.fee_earned)}`}
                                {voucher.source === 'royalty' &&
                                    ` • Potongan royalti ${rupiah.format(voucher.discount_given)}`}
                            </p>
                        </div>
                        {canToggle && (
                            <Button
                                variant="outline2"
                                className="shrink-0"
                                onClick={() => onToggle(voucher)}
                            >
                                {voucher.is_active ? 'Matikan' : 'Aktifkan'}
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
