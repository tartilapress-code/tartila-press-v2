import { http } from '@/lib/http';
import { queryString, type PageMeta } from '@/lib/pagination';

// ---------------------------------------------------------------- tipe -----

export type Pustaka = 'fiksi' | 'non_fiksi';
export type AccessReason =
    'author' | 'subscription' | 'purchase' | 'free' | 'locked';

export type Access = {
    allowed: boolean;
    reason: AccessReason;
    expires_at: string | null;
};

export type ReaderBook = {
    id: number;
    book: {
        title: string;
        authors: string;
        cover: string | null;
        description?: string | null;
        about?: string | null;
        isbn?: string | null;
    };
    pustaka: Pustaka;
    pustaka_label: string;
    education_field: string | null;
    category: string | null;
    genre: string | null;
    age_limit: string;
    age_label: string;
    language: string;
    language_label: string;
    page_count: number;
    price: number | null;
    access_days: number | null;
    free_now: boolean;
    top_page_readers: number;
    likes_count: number;
    saves_count: number;
    comments_count: number;
    version: number;
    updated_at: string | null;
    can_read_now?: boolean;
    me?: {
        liked: boolean;
        saved: boolean;
        last_page: number | null;
        access: Access | null;
    };
};

export type Option = { value: string; label: string };
export type Term = { id: number; name: string };

export type Filters = {
    pustaka: Option[];
    education_fields: Term[];
    categories: (Term & { pustaka: Pustaka | null })[];
    genres: Term[];
    age_limits: Option[];
    languages: Option[];
};

export type Plan = {
    id: number;
    name: string;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    period_label: string;
    price: number;
    description: string | null;
};

export type Comment = {
    id: number;
    body: string;
    user: { id: number | null; name: string };
    created_at: string | null;
};

export type PaymentMethod = {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder_name: string;
};

export type Order = {
    id: number;
    order_number: string;
    kind: 'book' | 'plan';
    title: string;
    amount: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    payment_due_at: string | null;
    payment_verification_note: string | null;
    has_payment_proof: boolean;
    confirmed_at: string | null;
    created_at: string;
    payment_method: PaymentMethod | null;
    user?: { id: number; name: string; email: string };
};

export type Bookmark = {
    id: number;
    page: number;
    note: string | null;
};

export type CatalogParams = {
    q?: string;
    pustaka?: string;
    education_field_id?: string;
    category_id?: string;
    genre_id?: string;
    age_limit?: string;
    language?: string;
    access?: string;
    sort?: string;
    page?: number;
    per_page?: number;
};

type Page<T> = { data: T[]; meta: PageMeta };

export const PERIOD_LABEL: Record<Plan['period'], string> = {
    daily: 'Harian',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
};

// ------------------------------------------------------------ katalog -----

export const filters = (): Promise<{ data: Filters }> =>
    http.get('/reader/filters');

export const catalog = (
    params: CatalogParams = {}
): Promise<Page<ReaderBook>> =>
    http.get(`/reader/books${queryString({ ...params })}`);

export const book = (id: number | string): Promise<{ data: ReaderBook }> =>
    http.get(`/reader/books/${id}`);

export const plans = (): Promise<{ data: Plan[] }> => http.get('/reader/plans');

export const comments = (
    id: number | string,
    page = 1
): Promise<Page<Comment>> =>
    http.get(`/reader/books/${id}/comments${queryString({ page })}`);

export const paymentMethods = (): Promise<{ data: PaymentMethod[] }> =>
    http.get('/payment-methods');

// ------------------------------------------------------------ pembaca -----

export const like = (id: number, on: boolean) =>
    on
        ? http.post(`/reader/books/${id}/like`)
        : http.delete(`/reader/books/${id}/like`);

export const save = (id: number, on: boolean) =>
    on
        ? http.post(`/reader/books/${id}/save`)
        : http.delete(`/reader/books/${id}/save`);

export const addComment = (
    id: number,
    body: string
): Promise<{ data: Comment }> =>
    http.post(`/reader/books/${id}/comments`, { body });

export const deleteComment = (id: number) =>
    http.delete(`/reader/comments/${id}`);

export const recordReads = (id: number, pages: number[]) =>
    http.post(`/reader/books/${id}/reads`, { pages });

export const saveProgress = (id: number, page: number) =>
    http.put(`/reader/books/${id}/progress`, { page });

export const bookmarks = (id: number): Promise<{ data: Bookmark[] }> =>
    http.get(`/reader/books/${id}/bookmarks`);

export const addBookmark = (
    id: number,
    page: number,
    note?: string
): Promise<{ data: Bookmark }> =>
    http.post(`/reader/books/${id}/bookmarks`, { page, note: note || null });

export const deleteBookmark = (id: number) =>
    http.delete(`/reader/bookmarks/${id}`);

export const shelf = (
    tab: 'reading' | 'saved' | 'liked' | 'purchased'
): Promise<{ data: ReaderBook[] }> => http.get(`/reader/me/shelf?tab=${tab}`);

export type MyBookmark = Bookmark & { reader_book_id: number; title: string };

export const myBookmarks = (): Promise<{ data: MyBookmark[] }> =>
    http.get('/reader/me/bookmarks');

export type MyAccess = {
    subscription: {
        plan: string | null;
        starts_at: string;
        ends_at: string | null;
    } | null;
    purchases: {
        reader_book_id: number;
        title: string | null;
        ends_at: string | null;
    }[];
};

export const myAccess = (): Promise<{ data: MyAccess }> =>
    http.get('/reader/me/access');

export const myOrders = (): Promise<{ data: Order[] }> =>
    http.get('/reader/orders');

export const createOrder = (
    kind: 'book' | 'plan',
    targetId: number,
    paymentMethodId: number | null
): Promise<{ data: Order }> =>
    http.post('/reader/orders', {
        kind,
        target_id: targetId,
        payment_method_id: paymentMethodId,
    });

export const uploadProof = (
    id: number,
    file: File
): Promise<{ data: Order }> => {
    const form = new FormData();
    form.append('file', file);

    return http.upload(`/reader/orders/${id}/proof`, form);
};

export type MyRoyalty = {
    from: string;
    to: string;
    my_total: number;
    rows: {
        reader_book_id: number;
        title: string;
        authors_count: number;
        orders: number;
        read_events: number;
        purchase_royalty: number;
        read_royalty: number;
        total: number;
        my_amount: number;
    }[];
};

export const myRoyalty = (
    from: string,
    to: string
): Promise<{ data: MyRoyalty }> =>
    http.get(`/reader/me/royalty${queryString({ from, to })}`);

// ----------------------------------------------------------- notifikasi ----

export type Notification = {
    id: number;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
};

export const notifications = (
    page = 1
): Promise<{ data: Notification[]; meta: PageMeta }> =>
    http.get(
        `/notifications${queryString({ scope: 'reader', page, per_page: 20 })}`
    );

export const notificationSummary = (): Promise<{
    data: { unread_total: number };
}> => http.get('/notifications/summary?scope=reader');

export const markNotificationsRead = (payload: {
    all?: boolean;
    ids?: number[];
}) => http.post('/notifications/read?scope=reader', payload);

// ------------------------------------------------------------------ admin --

export type AdminBook = ReaderBook & {
    book_id: number;
    is_published: boolean;
    has_file: boolean;
    file_name: string | null;
    file_size: number | null;
    education_field_id: number | null;
    category_id: number | null;
    genre_id: number | null;
    purchase_royalty_percent: number | null;
    read_fee: number | null;
    read_events: number;
    book_active: boolean;
};

export type AdminBookInput = Partial<{
    book_id: number;
    is_published: boolean;
    pustaka: Pustaka;
    education_field_id: number | null;
    category_id: number | null;
    genre_id: number | null;
    age_limit: string;
    language: string;
    price: number | null;
    access_days: number | null;
    purchase_royalty_percent: number | null;
    read_fee: number | null;
}>;

export type Candidate = {
    id: number;
    title: string;
    authors: string | null;
    cover: string | null;
    language: string | null;
};

export const adminBooks = (params: {
    page?: number;
    search?: string;
}): Promise<Page<AdminBook>> =>
    http.get(`/admin/reader/books${queryString({ ...params })}`);

export const adminBook = (id: number | string): Promise<{ data: AdminBook }> =>
    http.get(`/admin/reader/books/${id}`);

export const adminCandidates = (
    search: string
): Promise<{ data: Candidate[] }> =>
    http.get(`/admin/reader/books/candidates${queryString({ search })}`);

export const adminCreateBook = (
    input: AdminBookInput
): Promise<{ data: AdminBook; message: string }> =>
    http.post('/admin/reader/books', input);

export const adminUpdateBook = (
    id: number,
    input: AdminBookInput
): Promise<{ data: AdminBook; message: string }> =>
    http.patch(`/admin/reader/books/${id}`, input);

export const adminDeleteBook = (id: number) =>
    http.delete(`/admin/reader/books/${id}`);

export type AdminTerm = {
    id: number;
    type: 'education_field' | 'category' | 'genre';
    name: string;
    pustaka: Pustaka | null;
};

export const adminTerms = (): Promise<{ data: AdminTerm[] }> =>
    http.get('/admin/reader/terms');

export const adminSaveTerm = (
    term: Pick<AdminTerm, 'type' | 'name' | 'pustaka'>,
    id?: number
): Promise<{ data: AdminTerm }> =>
    id
        ? http.put(`/admin/reader/terms/${id}`, term)
        : http.post('/admin/reader/terms', term);

export const adminDeleteTerm = (id: number) =>
    http.delete(`/admin/reader/terms/${id}`);

export type AdminPlan = Plan & { is_active: boolean };

export const adminPlans = (): Promise<{ data: AdminPlan[] }> =>
    http.get('/admin/reader/plans');

export const adminSavePlan = (
    plan: {
        name: string;
        period: Plan['period'];
        price: number;
        description: string | null;
        is_active: boolean;
    },
    id?: number
): Promise<{ data: AdminPlan }> =>
    id
        ? http.put(`/admin/reader/plans/${id}`, plan)
        : http.post('/admin/reader/plans', plan);

export const adminDeactivatePlan = (id: number) =>
    http.delete(`/admin/reader/plans/${id}`);

export type AccessRule = {
    id: number;
    reader_book_id: number | null;
    title: string | null;
    action: 'open' | 'lock';
    starts_at: string;
    ends_at: string | null;
    note: string | null;
    active: boolean;
};

export const adminRules = (): Promise<{ data: AccessRule[] }> =>
    http.get('/admin/reader/rules');

export const adminAddRule = (rule: {
    reader_book_id: number | null;
    action: 'open' | 'lock';
    starts_at: string;
    ends_at: string | null;
    note: string | null;
}) => http.post('/admin/reader/rules', rule);

export const adminDeleteRule = (id: number) =>
    http.delete(`/admin/reader/rules/${id}`);

export type Settings = { purchase_royalty_percent: number; read_fee: number };

export const adminSettings = (): Promise<{ data: Settings }> =>
    http.get('/admin/reader/settings');

export const adminSaveSettings = (
    settings: Settings
): Promise<{ data: Settings; message: string }> =>
    http.put('/admin/reader/settings', settings);

export const adminOrders = (params: {
    page?: number;
    status?: string;
    kind?: string;
}): Promise<
    Page<Order> & { meta: PageMeta & { counts: Record<string, number> } }
> => http.get(`/admin/reader/orders${queryString({ ...params })}`);

export const adminProof = (id: number): Promise<Blob> =>
    http.blob(`/admin/reader/orders/${id}/proof`);

export const adminVerify = (
    id: number,
    decision: 'approve' | 'reject',
    note?: string
): Promise<{ data: Order; message: string }> =>
    http.post(`/admin/reader/orders/${id}/verify`, {
        decision,
        note: note || null,
    });

export type RoyaltyRow = {
    reader_book_id: number;
    title: string;
    orders: number;
    revenue: number;
    purchase_percent: number;
    purchase_royalty: number;
    readers: number;
    read_events: number;
    read_fee: number;
    read_royalty: number;
    total: number;
    authors: { user_id: number; name: string; amount: number }[];
};

export const adminRoyalties = (params: {
    from: string;
    to: string;
    search?: string;
    page?: number;
}): Promise<{
    data: RoyaltyRow[];
    meta: PageMeta & {
        from: string;
        to: string;
        totals: {
            revenue: number;
            purchase_royalty: number;
            read_events: number;
            read_royalty: number;
            total: number;
        };
    };
}> => http.get(`/admin/reader/royalties${queryString({ ...params })}`);
