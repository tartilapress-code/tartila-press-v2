import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type EntryType =
    'editor_fee' | 'coauthor_fee' | 'royalty' | 'ebook_royalty' | 'sales_fee';

export type WalletEntry = {
    type: EntryType;
    label: string;
    title: string;
    detail: string | null;
    amount: number;
    date: string | null;
};

export type WithdrawalStatus = 'pending' | 'paid' | 'rejected';

export type Withdrawal = {
    id: number;
    user_id: number;
    amount: string;
    admin_fee: string;
    net_amount: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    status: WithdrawalStatus;
    admin_note: string | null;
    processed_at: string | null;
    created_at: string;
    user?: { id: number; name: string; email: string };
};

export type Wallet = {
    summary: {
        earned: number;
        withdrawn: number;
        pending: number;
        balance: number;
        by_type: Record<EntryType, number>;
    };
    entries: WalletEntry[];
    withdrawals: Withdrawal[];
    config: { admin_fee: number; min_amount: number };
};

export const TYPE_LABEL: Record<EntryType, string> = {
    editor_fee: 'Fee editor',
    coauthor_fee: 'Fee co-author',
    royalty: 'Royalti penulis',
    ebook_royalty: 'Royalti ebook',
    sales_fee: 'Fee penjualan',
};

export const STATUS_LABEL: Record<WithdrawalStatus, string> = {
    pending: 'Menunggu diproses',
    paid: 'Sudah ditransfer',
    rejected: 'Ditolak',
};

export const show = () => http.get('/wallet');

export const withdraw = (payload: {
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
}) => http.post('/wallet/withdrawals', payload);

// Admin
// Per halaman (bawaan 20): ?status= (kosong = semua).
export const adminList = (params: { status?: string } & PageParams = {}) =>
    http.get(`/admin/withdrawals${queryString(params)}`);

export const adminPay = (
    id: number,
    note?: string,
    paymentMethodId?: number | null
) =>
    http.post(`/admin/withdrawals/${id}/pay`, {
        admin_note: note || null,
        payment_method_id: paymentMethodId ?? null,
    });

export const adminReject = (id: number, note?: string) =>
    http.post(`/admin/withdrawals/${id}/reject`, { admin_note: note || null });
