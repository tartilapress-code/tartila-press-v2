import { http } from '@/lib/http';
import { queryString, type PageMeta } from '@/lib/pagination';

export type PartnerStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const STATUS_LABEL: Record<PartnerStatus, string> = {
    draft: 'Draf',
    submitted: 'Menunggu persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak — perlu perbaikan',
};

export type DocumentKind = 'turnitin' | 'originality' | 'mou';

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
    turnitin: 'Hasil Turnitin (di bawah 20%)',
    originality: 'Surat keaslian naskah (oleh penulis)',
    mou: 'MOU (ditandatangani Tartila Press, penerbit mitra, dan penulis)',
};

export type PartnerDocument = {
    label: string;
    name: string | null;
    percent: number | null;
    uploaded_at: string | null;
} | null;

export type PartnerBook = {
    id: number;
    title: string;
    slug: string;
    description: string | null;
    about: string | null;
    front_cover: string | null;
    status: PartnerStatus;
    note: string | null;
    editable: boolean;
    submitted_at: string | null;
    reviewed_at: string | null;
    partner: { id: number; company_name: string; user_id: number } | null;
    authors: { id: number; name: string }[];
    reader_book_id: number | null;
    pustaka: 'fiksi' | 'non_fiksi' | null;
    education_field_id: number | null;
    category_id: number | null;
    genre_id: number | null;
    age_limit: string | null;
    language: string | null;
    price: number | null;
    access_days: number | null;
    is_listed: boolean;
    ebook: {
        has: boolean;
        name: string | null;
        pages: number | null;
        uploaded_at: string | null;
    };
    documents: Record<DocumentKind, PartnerDocument>;
    // Hal yang masih kurang sebelum bisa diajukan.
    missing: string[];
    events?: {
        action: string;
        note: string | null;
        by: string | null;
        created_at: string | null;
    }[];
};

export type PartnerBookInput = {
    title?: string;
    description?: string | null;
    about?: string | null;
    front_cover?: string | null;
    author_ids?: number[];
    pustaka?: 'fiksi' | 'non_fiksi';
    education_field_id?: number | null;
    category_id?: number | null;
    genre_id?: number | null;
    age_limit?: string;
    language?: string;
    price?: number | null;
    access_days?: number | null;
};

export type PartnerTerm = {
    id: number;
    type: 'education_field' | 'category' | 'genre';
    name: string;
    pustaka: 'fiksi' | 'non_fiksi' | null;
};

type Page<T> = { data: T[]; meta: PageMeta };

// ---------------------------------------------------------- mitra ----------

export const myBooks = (): Promise<{
    data: PartnerBook[];
    meta: { company_name: string };
}> => http.get('/partner/books');

export const myBook = (id: number | string): Promise<{ data: PartnerBook }> =>
    http.get(`/partner/books/${id}`);

export const terms = (): Promise<{ data: PartnerTerm[] }> =>
    http.get('/partner/terms');

export const createBook = (
    input: PartnerBookInput
): Promise<{ data: PartnerBook; message: string }> =>
    http.post('/partner/books', input);

export const updateBook = (
    id: number,
    input: PartnerBookInput
): Promise<{ data: PartnerBook; message: string }> =>
    http.put(`/partner/books/${id}`, input);

export const deleteBook = (id: number) => http.delete(`/partner/books/${id}`);

export const uploadEbook = (
    id: number,
    file: File,
    pageCount?: number
): Promise<{ data: PartnerBook; message: string }> => {
    const form = new FormData();
    form.append('file', file);
    if (pageCount) form.append('page_count', String(pageCount));

    return http.upload(`/partner/books/${id}/ebook`, form);
};

export const uploadDocument = (
    id: number,
    kind: DocumentKind,
    file: File,
    percent?: string
): Promise<{ data: PartnerBook; message: string }> => {
    const form = new FormData();
    form.append('file', file);
    if (percent !== undefined && percent !== '') {
        form.append('percent', percent);
    }

    return http.upload(`/partner/books/${id}/documents/${kind}`, form);
};

export const downloadFile = (id: number, kind: DocumentKind | 'ebook') =>
    http.blob(`/partner/books/${id}/documents/${kind}`);

export const submitBook = (
    id: number
): Promise<{ data: PartnerBook; message: string }> =>
    http.post(`/partner/books/${id}/submit`);

export const reopenBook = (
    id: number
): Promise<{ data: PartnerBook; message: string }> =>
    http.post(`/partner/books/${id}/reopen`);

export type ReportRow = {
    reader_book_id: number;
    book_id: number;
    title: string;
    orders: number;
    revenue: number;
    purchase_royalty: number;
    read_events: number;
    read_fee: number;
    read_royalty: number;
    my_amount: number;
    authors: { user_id: number; name: string; amount: number }[];
};

export const report = (
    from: string,
    to: string
): Promise<{
    data: { from: string; to: string; rows: ReportRow[]; total: number };
}> => http.get(`/partner/report${queryString({ from, to })}`);

export const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', 'covers');
    const response = await http.upload('/auth/uploads/images', form);

    return response.data.url as string;
};

export const searchUsers = (
    q: string
): Promise<{ data: { id: number; name: string }[] }> =>
    http.get(`/users/search${queryString({ q })}`);

// ---------------------------------------------------------- admin ----------

export type Partner = {
    id: number;
    user_id: number;
    name: string | null;
    email: string | null;
    company_name: string;
    phone: string | null;
    address: string | null;
    is_active: boolean;
    books: Partial<Record<PartnerStatus, number>>;
};

export const adminPartners = (): Promise<{ data: Partner[] }> =>
    http.get('/admin/reader/partners');

export const adminAddPartner = (input: {
    user_id: number;
    company_name: string;
    phone?: string;
    address?: string;
}) => http.post('/admin/reader/partners', input);

export const adminUpdatePartner = (
    id: number,
    input: Partial<{
        company_name: string;
        phone: string | null;
        address: string | null;
        is_active: boolean;
    }>
) => http.put(`/admin/reader/partners/${id}`, input);

export const adminDeletePartner = (id: number) =>
    http.delete(`/admin/reader/partners/${id}`);

export const adminBooks = (params: {
    page?: number;
    status?: string;
    search?: string;
    partner_id?: number;
}): Promise<Page<PartnerBook>> =>
    http.get(`/admin/reader/partner-books${queryString({ ...params })}`);

export const adminBook = (
    id: number | string
): Promise<{ data: PartnerBook }> =>
    http.get(`/admin/reader/partner-books/${id}`);

export const adminApprove = (
    id: number
): Promise<{ data: PartnerBook; message: string }> =>
    http.post(`/admin/reader/partner-books/${id}/approve`);

export const adminReject = (
    id: number,
    note: string
): Promise<{ data: PartnerBook; message: string }> =>
    http.post(`/admin/reader/partner-books/${id}/reject`, { note });

export const adminDownload = (id: number, kind: DocumentKind | 'ebook') =>
    http.blob(`/admin/reader/partner-books/${id}/documents/${kind}`);
