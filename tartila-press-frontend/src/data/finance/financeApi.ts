import { http } from '@/lib/http';

export type Account = { id: number; name: string; is_active?: boolean };

export type Totals = {
    in: number;
    out: number;
    net: number;
    hold: number;
    count: number;
};

export type AccountBalance = {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder_name: string;
    is_active: boolean;
    opening_balance: number;
    in: number;
    out: number;
    balance: number;
};

export type RevenuePoint = {
    label: string;
    period: string;
    amount: number;
    count: number;
};

export type FinanceSummary = {
    balances: {
        accounts: AccountBalance[];
        unassigned: { in: number; out: number; balance: number; count: number };
        total: number;
    };
    month_totals: Totals;
    all_totals: Totals;
    revenue: {
        daily: RevenuePoint[];
        monthly: RevenuePoint[];
        yearly: RevenuePoint[];
    };
    year: number;
    month: number;
};

export type LedgerEntry = {
    key: string;
    source: 'order' | 'reader_day' | 'withdrawal' | 'manual';
    source_id: number;
    date: string;
    direction: 'in' | 'out';
    type: string;
    type_label: string;
    description: string;
    party: string | null;
    account: Account | null;
    amount: number;
    status: 'completed' | 'hold';
};

export type LedgerFilters = Partial<{
    from: string;
    to: string;
    direction: '' | 'in' | 'out';
    type: string;
    status: '' | 'completed' | 'hold';
    account: string;
}>;

export type LedgerResponse = {
    items: LedgerEntry[];
    totals: Totals;
    types: Record<string, string>;
    manual_categories: Record<string, string>;
    accounts: Account[];
};

export type ManualTransactionPayload = {
    transaction_date: string;
    direction: 'in' | 'out';
    category: string;
    payment_method_id: number | null;
    amount: number;
    status: 'completed' | 'hold';
    description: string;
};

type Copies = { base: number; extra: number; extra_auto: number };

/** Isian admin apa adanya (null = otomatis). */
export type Overrides = {
    book_price: number | null;
    extra_copies: number | null;
    includes_hki: boolean | null;
    admin_cover_cost: number | null;
    speaker_fee: number | null;
    other_costs: number | null;
    note: string | null;
};

export type PackageRow = {
    id: number;
    order_number: string;
    date: string;
    buyer: string | null;
    name: string;
    type: 'package' | 'custom_package';
    status: 'completed' | 'hold';
    received: number;
    price: number;
    discount: number;
    editor_fee: number;
    editor_fee_source: 'manuscript' | 'order';
    includes_hki: boolean;
    hki_auto: boolean;
    hki: number;
    book_title: string | null;
    book_price: number;
    book_price_source: 'admin' | 'book' | 'default';
    copies: Copies;
    print_cost: number;
    admin_cover: number;
    other_costs: number;
    note: string | null;
    overrides: Overrides;
    total_costs: number;
    profit: number;
};

export type BookChapterRow = {
    id: number;
    title: string;
    date: string | null;
    chapter_count: number;
    sold_count: number;
    owner_editor: string | null;
    status: 'completed' | 'hold';
    received: number;
    price: number;
    discount: number;
    editor_fee: number;
    includes_hki: boolean;
    hki_auto: boolean;
    hki: number;
    book_price: number;
    book_price_source: 'admin' | 'default';
    copies: Copies;
    print_cost: number;
    admin_cover: number;
    auto_other_costs: number;
    manual_other_costs: number;
    other_costs: number;
    note: string | null;
    overrides: Overrides;
    total_costs: number;
    profit: number;
};

export type BookRow = {
    id: number;
    title: string;
    quantity: number;
    unit_price: number;
    status: 'completed' | 'hold';
    hold_count: number;
    price: number;
    discount: number;
    print_cost: number;
    royalty_rate: number;
    royalty: number;
    other_costs: number;
    note: string | null;
    overrides: Overrides;
    total_costs: number;
    profit: number;
};

export type EbookRow = {
    id: number;
    kind: 'book' | 'subscription';
    title: string;
    status: 'completed' | 'hold';
    orders: number;
    read_events: number;
    price: number;
    purchase_percent: number;
    purchase_royalty: number;
    read_fee: number;
    read_royalty: number;
    total_costs: number;
    profit: number;
};

export type EventRow = {
    id: number;
    title: string;
    date: string | null;
    status: 'completed' | 'hold';
    fee: number;
    participants: number;
    paid_count: number;
    price: number;
    discount: number;
    speaker_fee: number;
    other_costs: number;
    note: string | null;
    overrides: Overrides;
    total_costs: number;
    profit: number;
};

export type FinanceSettings = {
    admin_cover_cost: number;
    print_cost_percent: number;
    base_print_copies: number;
    default_book_price: number;
    hki_cost: number;
};

export type DetailPayload = {
    subject_type: 'order' | 'book' | 'event';
    subject_id: number;
    book_price?: number | null;
    extra_copies?: number | null;
    includes_hki?: boolean | null;
    admin_cover_cost?: number | null;
    speaker_fee?: number | null;
    other_costs?: number | null;
    note?: string | null;
};

function query(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
            search.set(key, String(value));
        }
    });

    const text = search.toString();

    return text ? `?${text}` : '';
}

export const summary = (year: number, month: number) =>
    http.get(`/admin/finance/summary${query({ year, month })}`);

export const transactions = (filters: LedgerFilters) =>
    http.get(`/admin/finance/transactions${query(filters)}`);

export const createTransaction = (payload: ManualTransactionPayload) =>
    http.post('/admin/finance/transactions', payload);

export const updateTransaction = (
    id: number,
    payload: ManualTransactionPayload
) => http.patch(`/admin/finance/transactions/${id}`, payload);

export const deleteTransaction = (id: number) =>
    http.delete(`/admin/finance/transactions/${id}`);

export const assignAccount = (
    source: 'order' | 'withdrawal',
    id: number,
    paymentMethodId: number | null
) =>
    http.patch(`/admin/finance/accounts/${source}/${id}`, {
        payment_method_id: paymentMethodId,
    });

export const packages = (from?: string, to?: string) =>
    http.get(`/admin/finance/packages${query({ from, to })}`);

export const books = (from?: string, to?: string) =>
    http.get(`/admin/finance/books${query({ from, to })}`);

export const ebooks = (from?: string, to?: string) =>
    http.get(`/admin/finance/ebooks${query({ from, to })}`);

export const events = () => http.get('/admin/finance/events');

export const saveDetail = (payload: DetailPayload) =>
    http.put('/admin/finance/details', payload);

export const settings = () => http.get('/admin/finance/settings');

export const saveSettings = (payload: FinanceSettings) =>
    http.put('/admin/finance/settings', payload);

export const saveOpeningBalance = (paymentMethodId: number, amount: number) =>
    http.patch(
        `/admin/finance/payment-methods/${paymentMethodId}/opening-balance`,
        { opening_balance: amount }
    );
