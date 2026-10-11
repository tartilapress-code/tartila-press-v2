import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type TargetType = 'all' | 'package' | 'custom_item' | 'book';

export type VoucherTarget = {
    type: TargetType;
    id: number | null;
    label?: string;
};

export type VoucherStatus =
    'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive' | 'reset';

export type VoucherSource = 'admin' | 'grant' | 'royalty';

export type Voucher = {
    id: number;
    code: string;
    source: VoucherSource;
    name: string | null;
    user_id: number | null;
    user_name: string | null;
    grant_id: number | null;
    targets: Required<VoucherTarget>[];
    discount_percent: number;
    fee_percent: number;
    max_uses: number | null;
    cycle: number | null;
    starts_at: string | null;
    expires_at: string | null;
    is_active: boolean;
    reset_at: string | null;
    status: VoucherStatus;
    uses: number;
    completed_uses: number;
    fee_earned: number;
    discount_given: number;
    created_at: string;
};

export type VoucherGrant = {
    id: number;
    user_id: number;
    user_name: string | null;
    user_email: string | null;
    name: string | null;
    targets: Required<VoucherTarget>[];
    pool_percent: number;
    max_vouchers: number;
    period_days: number;
    starts_at: string;
    ends_at: string | null;
    is_active: boolean;
    status: 'active' | 'scheduled' | 'expired' | 'inactive';
    cycle_ends_at: string | null;
    used_quota: number;
    vouchers_count: number;
};

export type DiscountRow = {
    type: 'package' | 'custom_item' | 'book';
    id: number;
    kind_label: string;
    name: string;
    price: number;
    discount: number;
    final_price: number;
    is_active: boolean;
    status: 'active' | 'none';
    editor_owned: boolean;
};

export type MyGrant = {
    id: number;
    name: string | null;
    targets: Required<VoucherTarget>[];
    pool_percent: number;
    max_vouchers: number;
    period_days: number;
    starts_at: string;
    ends_at: string | null;
    status: 'active' | 'scheduled' | 'expired' | 'inactive';
    cycle_starts_at: string | null;
    cycle_ends_at: string | null;
    used_quota: number;
    vouchers: Voucher[];
};

export type MyRoyaltyBook = {
    book_id: number;
    title: string;
    role: 'author' | 'editor';
    royalty_percentage: number;
    vouchers: Voucher[];
};

export type MyVouchers = {
    eligible: boolean;
    grants: MyGrant[];
    royalty_books: MyRoyaltyBook[];
    totals: { fee_earned: number; uses: number };
};

export type VoucherQuote = {
    code: string;
    name: string | null;
    discount_percent: number;
    voucher_discount: number;
};

export const STATUS_LABEL: Record<VoucherStatus, string> = {
    active: 'Aktif',
    scheduled: 'Belum mulai',
    expired: 'Kedaluwarsa',
    exhausted: 'Kuota habis',
    inactive: 'Nonaktif',
    reset: 'Direset',
};

export const SOURCE_LABEL: Record<VoucherSource, string> = {
    admin: 'Admin',
    grant: 'Hak voucher',
    royalty: 'Dari royalti',
};

// Pengguna
export const mine = () => http.get('/vouchers/mine');

export const createMine = (payload: {
    source: 'grant' | 'royalty';
    grant_id?: number;
    book_id?: number;
    code?: string;
    discount_percent: number;
    fee_percent?: number;
}) => http.post('/vouchers/mine', payload);

export const toggleMine = (id: number, isActive: boolean) =>
    http.patch(`/vouchers/mine/${id}`, { is_active: isActive });

// Admin: diskon produk
// Tanpa page: daftar ringkas lengkap (pemilih target voucher).
export const adminListDiscounts = () => http.get('/admin/discounts');

// Per halaman (bawaan 50) untuk tab Diskon; meta.active_count = produk sedang diskon.
export const adminPageDiscounts = (
    params: { kind?: string; status?: string; search?: string } & PageParams
) => http.get(`/admin/discounts${queryString(params)}`);

export const adminApplyDiscount = (
    items: { type: string; id: number }[],
    percent: number
) => http.post('/admin/discounts/apply', { items, percent });

export const adminResetDiscounts = (
    target: { all: true } | { items: { type: string; id: number }[] }
) => http.post('/admin/discounts/reset', target);

// Admin: voucher
export type AdminVoucherPayload = {
    name?: string | null;
    code?: string | null;
    targets: VoucherTarget[];
    discount_percent: number;
    max_uses?: number | null;
    starts_at?: string | null;
    expires_at?: string | null;
    is_active?: boolean;
};

export const adminListVouchers = () => http.get('/admin/vouchers');

export const adminCreateVoucher = (payload: AdminVoucherPayload) =>
    http.post('/admin/vouchers', payload);

export const adminUpdateVoucher = (
    id: number,
    payload: Partial<AdminVoucherPayload>
) => http.patch(`/admin/vouchers/${id}`, payload);

export const adminResetVouchers = (target: { all: true } | { ids: number[] }) =>
    http.post('/admin/vouchers/reset', target);

// Admin: hak voucher
export type GrantPayload = {
    // Penerima saat membuat: daftar id, atau semua yang berhak.
    user_ids?: number[];
    all_eligible?: boolean;
    name?: string | null;
    targets: VoucherTarget[];
    pool_percent: number;
    max_vouchers: number;
    period_days: number;
    starts_at?: string | null;
    ends_at?: string | null;
    is_active?: boolean;
};

export const adminListGrants = () => http.get('/admin/voucher-grants');

export const adminEligibleUsers = (q: string) =>
    http.get(`/admin/voucher-grants/eligible-users?q=${encodeURIComponent(q)}`);

export const adminCreateGrant = (payload: GrantPayload) =>
    http.post('/admin/voucher-grants', payload);

export const adminUpdateGrant = (id: number, payload: Partial<GrantPayload>) =>
    http.patch(`/admin/voucher-grants/${id}`, payload);

export const adminDeleteGrant = (id: number) =>
    http.delete(`/admin/voucher-grants/${id}`);
