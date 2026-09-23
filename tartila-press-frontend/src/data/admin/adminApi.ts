import { http } from '@/lib/http';

export const listUsers = () => http.get('/admin/users');

export const updateUserRoles = (userId: number, roles: string[]) =>
    http.patch(`/admin/users/${userId}/roles`, { roles });

export const listRoleRequests = (status?: string) =>
    http.get(`/admin/role-requests${status ? `?status=${status}` : ''}`);

export const approveRoleRequest = (id: number) =>
    http.post(`/admin/role-requests/${id}/approve`);

export const rejectRoleRequest = (id: number, note?: string) =>
    http.post(`/admin/role-requests/${id}/reject`, { note });

export type PackagePayload = Partial<{
    name: string;
    photo: string;
    category: string;
    price: number | string;
    discount: number;
    description: string;
    terms: string[];
    facilities: string[];
    services: string[];
    notes: string[];
    is_active: boolean;
}>;

export const listPackages = () => http.get('/admin/packages');

export const createPackage = (payload: PackagePayload) =>
    http.post('/admin/packages', payload);

export const updatePackage = (id: number, payload: PackagePayload) =>
    http.patch(`/admin/packages/${id}`, payload);

export const deletePackage = (id: number) =>
    http.delete(`/admin/packages/${id}`);

export type CustomPackageItemPayload = Partial<{
    type: 'facility' | 'service';
    name: string;
    price: number | string;
    description: string;
    is_active: boolean;
}>;

export const listCustomItems = () => http.get('/admin/custom-package-items');

export const createCustomItem = (payload: CustomPackageItemPayload) =>
    http.post('/admin/custom-package-items', payload);

export const updateCustomItem = (
    id: number,
    payload: CustomPackageItemPayload
) => http.patch(`/admin/custom-package-items/${id}`, payload);

export const deleteCustomItem = (id: number) =>
    http.delete(`/admin/custom-package-items/${id}`);

export const listOrders = () => http.get('/admin/orders');

export const updateOrderStatus = (id: number, status: string) =>
    http.patch(`/admin/orders/${id}/status`, { status });

export const verifyPayment = (
    id: number,
    payload: { decision: 'approve' | 'reject'; note?: string }
) => http.post(`/admin/orders/${id}/verify-payment`, payload);

export type PaymentMethodPayload = Partial<{
    bank_name: string;
    account_number: string;
    account_holder_name: string;
    is_active: boolean;
}>;

export const listPaymentMethodsAdmin = () =>
    http.get('/admin/payment-methods');

export const createPaymentMethod = (payload: PaymentMethodPayload) =>
    http.post('/admin/payment-methods', payload);

export const updatePaymentMethod = (
    id: number,
    payload: PaymentMethodPayload
) => http.patch(`/admin/payment-methods/${id}`, payload);

export const deletePaymentMethod = (id: number) =>
    http.delete(`/admin/payment-methods/${id}`);

export type BookShipmentPayload = Partial<{
    status:
        | 'pending'
        | 'confirmed'
        | 'printing'
        | 'packing'
        | 'shipping'
        | 'awaiting_confirmation'
        | 'delivered'
        | 'cancelled';
    estimated_arrival_date: string | null;
}>;

export const updateBookShipment = (
    id: number,
    payload: BookShipmentPayload
) => http.patch(`/admin/book-shipments/${id}`, payload);

export const listManuscripts = (status?: string) =>
    http.get(`/admin/manuscripts${status ? `?status=${status}` : ''}`);

export const reviewManuscriptRevision = (
    manuscriptId: number | string,
    revisionId: number | string,
    payload: { decision: 'approve' | 'reject'; note?: string }
) =>
    http.post(
        `/admin/manuscripts/${manuscriptId}/revisions/${revisionId}/review`,
        payload
    );

export const assignManuscriptEditor = (
    manuscriptId: number | string,
    payload: {
        editor_id: number;
        fee: number | string;
        deadline?: string;
        note?: string;
    }
) => http.post(`/admin/manuscripts/${manuscriptId}/assign-editor`, payload);

export const openManuscriptPool = (
    manuscriptId: number | string,
    payload: { fee: number | string; deadline?: string; note?: string }
) => http.post(`/admin/manuscripts/${manuscriptId}/open-pool`, payload);

export type BookPayload = Partial<{
    title: string;
    authors: string[];
    isbn: string;
    front_cover: string;
    back_cover: string;
    cover_layout_designer: string;
    description: string;
    book_category_id: number | string;
    field_category_id: number | string;
    price: number | string;
    discount: number;
    royalty_percentage: number | string | null;
    citation_publisher: string;
    citation_publication_date: string;
    google_scholar_url: string;
    is_active: boolean;
}>;

export const listBooksAdmin = () => http.get('/admin/books');

export const publishFromManuscript = (
    manuscriptId: number | string,
    payload: BookPayload
) => http.post(`/admin/books/from-manuscript/${manuscriptId}`, payload);

export const createBookManual = (payload: BookPayload) =>
    http.post('/admin/books/manual', payload);

export const updateBook = (id: number | string, payload: BookPayload) =>
    http.patch(`/admin/books/${id}`, payload);

export const deleteBook = (id: number | string) =>
    http.delete(`/admin/books/${id}`);

export const uploadBookPreview = (id: number | string, formData: FormData) =>
    http.upload(`/admin/books/${id}/preview`, formData);

export const combineBookChapters = (
    payload: BookPayload & { manuscript_ids: (number | string)[] }
) => http.post('/admin/books/chapter-compilation', payload);

export const uploadChapterPreview = (
    chapterId: number | string,
    formData: FormData
) => http.upload(`/admin/books/chapters/${chapterId}/preview`, formData);

export type CategoryPayload = { name: string };

export const listBookCategoriesAdmin = () => http.get('/book-categories');

export const createBookCategory = (payload: CategoryPayload) =>
    http.post('/admin/book-categories', payload);

export const updateBookCategory = (id: number, payload: CategoryPayload) =>
    http.patch(`/admin/book-categories/${id}`, payload);

export const deleteBookCategory = (id: number) =>
    http.delete(`/admin/book-categories/${id}`);

export const listFieldCategoriesAdmin = () => http.get('/field-categories');

export const createFieldCategory = (payload: CategoryPayload) =>
    http.post('/admin/field-categories', payload);

export const updateFieldCategory = (id: number, payload: CategoryPayload) =>
    http.patch(`/admin/field-categories/${id}`, payload);

export const deleteFieldCategory = (id: number) =>
    http.delete(`/admin/field-categories/${id}`);

export type ChapterInput = {
    title: string;
    price?: number | string | null;
    discount?: number | null;
    sop_terms?: string | null;
};

export type BookChapterProjectPayload = Partial<{
    title: string;
    book_category_id: number | string;
    field_category_id: number | string;
    price: number | string;
    discount: number;
    description: string;
    about: string;
    facilities: string[];
    services: string[];
    front_cover: string;
    back_cover: string;
    estimated_publish_date: string;
    submission_deadline: string;
    owner_editor_id: number | null;
    is_active: boolean;
    chapters: ChapterInput[];
}>;

export const listBookChapterProjectsAdmin = () =>
    http.get('/admin/book-chapter-projects');

export const getBookChapterProjectAdmin = (id: number | string) =>
    http.get(`/admin/book-chapter-projects/${id}`);

export const createBookChapterProjectAdmin = (payload: BookChapterProjectPayload) =>
    http.post('/admin/book-chapter-projects', payload);

export const updateBookChapterProjectAdmin = (
    id: number | string,
    payload: BookChapterProjectPayload
) => http.patch(`/admin/book-chapter-projects/${id}`, payload);

export const deleteBookChapterProjectAdmin = (id: number | string) =>
    http.delete(`/admin/book-chapter-projects/${id}`);

export const addBookChapterProjectChapterAdmin = (
    projectId: number | string,
    payload: ChapterInput
) => http.post(`/admin/book-chapter-projects/${projectId}/chapters`, payload);

export const updateBookChapterProjectChapterAdmin = (
    chapterId: number | string,
    payload: Partial<ChapterInput>
) => http.patch(`/admin/book-chapter-projects/chapters/${chapterId}`, payload);

export const deleteBookChapterProjectChapterAdmin = (chapterId: number | string) =>
    http.delete(`/admin/book-chapter-projects/chapters/${chapterId}`);

export const bulkImportBookChapterProjects = (formData: FormData) =>
    http.upload('/admin/book-chapter-projects/bulk-import', formData);

export type BookChapterSettingPayload = {
    min_chapters: number;
    max_chapters?: number | null;
    min_price: number | string;
    max_discount: number;
};

export const getBookChapterSettings = () => http.get('/admin/book-chapter-settings');

export const updateBookChapterSettings = (payload: BookChapterSettingPayload) =>
    http.patch('/admin/book-chapter-settings', payload);

export type ExternalSale = {
    id: number;
    marketplace_name: string;
    original_price: string;
    discount_percentage: number | null;
    discounted_price: string | null;
    quantity_sold: number;
};

export type RoyaltySummary = {
    id: number;
    title: string;
    authors_text: string;
    author: { id: number; name: string } | null;
    price: string;
    royalty_percentage: string;
    external_sales: ExternalSale[];
    total_orders_count: number;
    completed_orders_count: number;
    completed_quantity: number;
    system_royalty_amount: number;
    external_quantity: number;
    external_royalty_amount: number;
    total_quantity_sold: number;
    total_royalty_amount: number;
};

export type ExternalSalePayload = Partial<{
    marketplace_name: string;
    original_price: number | string;
    discount_percentage: number | null;
    discounted_price: number | string | null;
    quantity_sold: number;
}>;

export const listRoyalties = () => http.get('/admin/royalties');

export const createExternalSale = (
    bookId: number | string,
    payload: ExternalSalePayload
) => http.post(`/admin/books/${bookId}/external-sales`, payload);

export const updateExternalSale = (
    id: number | string,
    payload: ExternalSalePayload
) => http.patch(`/admin/external-sales/${id}`, payload);

export const deleteExternalSale = (id: number | string) =>
    http.delete(`/admin/external-sales/${id}`);
