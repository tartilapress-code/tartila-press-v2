import { RiBankLine, RiTimeLine } from '@remixicon/react';
import type { PaymentMethodChoice } from '@/hooks/usePaymentMethodChoice';

/**
 * Pilih rekening tujuan transfer sebelum pesanan dibuat. Rekening ini tampil
 * di invoice, beserta batas pembayaran 1×24 jam.
 */
export default function PaymentMethodPicker({
    choice,
}: {
    choice: PaymentMethodChoice;
}) {
    const { methods, selectedId, setSelectedId, isLoading } = choice;

    return (
        <fieldset className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
            <legend className="sr-only">Rekening tujuan pembayaran</legend>
            <p className="flex items-center gap-2 text-sm font-semibold text-oxford-navy-900">
                <RiBankLine
                    aria-hidden
                    className="size-5 text-forest-moss-700"
                />
                Pilih rekening tujuan transfer
            </p>

            {isLoading ? (
                <p className="text-sm text-oxford-navy-900/70">
                    Memuat rekening...
                </p>
            ) : methods.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/70">
                    Rekening tujuan akan diinformasikan admin.
                </p>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                    {methods.map((method) => (
                        <label
                            key={method.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 ring-1 transition-colors ${
                                selectedId === method.id
                                    ? 'ring-2 ring-oxford-navy-700'
                                    : 'ring-forest-moss-200 hover:ring-forest-moss-400'
                            }`}
                        >
                            <input
                                type="radio"
                                name="payment_method_id"
                                value={method.id}
                                checked={selectedId === method.id}
                                onChange={() => setSelectedId(method.id)}
                                className="mt-1"
                            />
                            <span className="flex flex-col text-sm">
                                <span className="font-semibold text-oxford-navy-900">
                                    {method.bank_name}
                                </span>
                                <span className="font-mono text-oxford-navy-900">
                                    {method.account_number}
                                </span>
                                <span className="text-oxford-navy-900/70">
                                    a.n. {method.account_holder_name}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
            )}

            <p className="flex items-start gap-2 text-xs text-oxford-navy-900/75">
                <RiTimeLine aria-hidden className="mt-0.5 size-4 shrink-0" />
                Setelah pesanan dibuat, Anda mendapat invoice. Selesaikan
                pembayaran dan unggah bukti transfer dalam 1×24 jam; jika tidak
                ada konfirmasi pembayaran, pesanan dibatalkan otomatis.
            </p>
        </fieldset>
    );
}
