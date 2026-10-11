import { useState } from 'react';
import * as orderApi from '@/data/order/orderApi';
import type { VoucherQuote } from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';

export type VoucherSelection = Pick<
    orderApi.CreateOrderPayload,
    'type' | 'package_id' | 'custom_item_ids' | 'book_chapter_id' | 'book_ids'
>;

/**
 * State kolom "masukkan voucher" di halaman pembayaran. Potongan voucher
 * dihitung server untuk pilihan produk saat ini; kalau pilihan berubah
 * sesudahnya, voucher dianggap kedaluwarsa (stale) dan harus diterapkan ulang
 * - kode tidak dikirim bersama pesanan sampai itu.
 */
export function useVoucher(selection: VoucherSelection | null) {
    const [input, setInput] = useState<string>('');
    const [applied, setApplied] = useState<{
        key: string;
        quote: VoucherQuote;
    } | null>(null);
    const [error, setError] = useState<string>('');
    const [isChecking, setIsChecking] = useState<boolean>(false);

    const key = selection ? JSON.stringify(selection) : '';
    const quote = applied && applied.key === key ? applied.quote : null;
    const isStale = applied !== null && applied.key !== key;

    async function apply() {
        if (!selection || !input.trim()) {
            return;
        }

        setIsChecking(true);
        setError('');

        try {
            const response = await orderApi.checkVoucher({
                ...selection,
                voucher_code: input.trim(),
            });
            setApplied({ key, quote: response.data });
        } catch (caught) {
            setApplied(null);
            setError(describeApiError(caught));
        } finally {
            setIsChecking(false);
        }
    }

    function clear() {
        setApplied(null);
        setInput('');
        setError('');
    }

    return {
        input,
        setInput,
        quote,
        isStale,
        error,
        isChecking,
        apply,
        clear,
        /** Kode yang boleh dikirim bersama pesanan (hanya kalau masih berlaku). */
        code: quote?.code,
        canApply: selection !== null && input.trim() !== '',
    };
}

export type VoucherState = ReturnType<typeof useVoucher>;
