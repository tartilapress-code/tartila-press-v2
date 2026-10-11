import type { Mou } from '@/data/mou/mouApi';
import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type IsbnStatus = 'draft' | 'signed' | 'processed';

export type IsbnApplication = {
    id: number;
    type: 'regular' | 'chapter';
    manuscript_id: number | null;
    book_id: number | null;
    applicant_id: number;
    title: string;
    authors_text: string;
    availability_link: string | null;
    letter_number: string;
    letter_date: string;
    applicant_data: {
        name: string;
        address: string;
        nik: string;
        phone: string;
    };
    signed_at: string | null;
    status: IsbnStatus;
    is_signed: boolean;
    signer_role: 'Penulis' | 'Editor';
    processed_at: string | null;
    applicant?: { id: number; name: string; email: string };
    // Hanya di daftar admin.
    book_published?: boolean;
    book_url?: string | null;
    form?: IsbnForm;
    attachments?: IsbnAttachments;
    // Paket biasa: MOU distribusi buku yang ditandatangani bersama surat.
    mou?: Mou | null;
};

export type IsbnForm = {
    request_type: string | null;
    title: string;
    authors: string[];
    editor: string | null;
    designer: string | null;
    media: string | null;
    reader_group: string | null;
    literature_type: string | null;
    translation: string | null;
    kdt: string | null;
    estimated_publish: string | null;
    province: string | null;
    city: string | null;
    distributor: string | null;
    description: string | null;
    pages: number | string | null;
    height_cm: number | string | null;
    edition: string | null;
    series: string | null;
    illustrations: string | null;
    publication_url: string | null;
};

export type IsbnAttachments = {
    dummy_files: {
        label: string;
        manuscript_id: number;
        revision_id: number;
        filename: string;
    }[];
    /** Dummy buku utuh (ebook / naskah gabungan / naskah terakhir). */
    dummy: { label: string; filename: string; is_pdf: boolean } | null;
    cover_url: string | null;
    has_cover: boolean;
};

export const STATUS_LABEL: Record<IsbnStatus, string> = {
    draft: 'Belum ditandatangani',
    signed: 'Siap diterbitkan',
    processed: 'Sudah diproses',
};

// Penulis / editor
export const open = (target: { manuscript_id: number } | { book_id: number }) =>
    http.post('/isbn-applications', target);

export const get = (id: number | string) =>
    http.get(`/isbn-applications/${id}`);

/** Penulis pertama (paket biasa) sekalian menyetujui & menandatangani MOU. */
export const sign = (
    id: number,
    signature: string,
    mou?: { mou_agreed: boolean; distribution_choice?: string[] }
) => http.post(`/isbn-applications/${id}/sign`, { signature, ...mou });

export const download = (id: number, inline = false) =>
    http.fetchFile(
        `/isbn-applications/${id}/download${inline ? '?inline=1' : ''}`
    );

// Admin
// Per halaman (bawaan 20): ?status=signed|processed (kosong = semua).
export const adminList = (params: { status?: string } & PageParams = {}) =>
    http.get(`/admin/isbn-applications${queryString(params)}`);

export const adminSaveForm = (id: number, payload: Partial<IsbnForm>) =>
    http.patch(`/admin/isbn-applications/${id}/form`, payload);

export const adminDownload = (id: number, inline = false) =>
    http.fetchFile(
        `/admin/isbn-applications/${id}/download${inline ? '?inline=1' : ''}`
    );

/** Dummy buku utuh untuk lampiran. */
export const adminDummy = (id: number) =>
    http.fetchFile(`/admin/isbn-applications/${id}/dummy`);

/** Foto cover buku (lewat API supaya bisa diolah di browser). */
export const adminCover = (id: number) =>
    http.fetchFile(`/admin/isbn-applications/${id}/cover`);

export type IsbnSettings = {
    city: string;
    publisher_name: string;
    publisher_address: string;
    website: string | null;
    email: string | null;
    responsible_name: string;
    admin_name: string | null;
    letter_code: string;
    subject: string;
    recipient: string;
    application_body: string;
    application_closing: string;
    statement_body: string;
    statement_closing: string;
    has_logo: boolean;
    has_signature: boolean;
    has_stamp: boolean;
};

export type AssetKind = 'logo' | 'signature' | 'stamp';

export const adminSettings = () => http.get('/admin/isbn-settings');

export const adminSaveSettings = (payload: Partial<IsbnSettings>) =>
    http.put('/admin/isbn-settings', payload);

export const adminResetSettings = () => http.post('/admin/isbn-settings/reset');

export const adminUploadAsset = (kind: AssetKind, file: File) => {
    const form = new FormData();
    form.append('file', file);

    return http.upload(`/admin/isbn-settings/assets/${kind}`, form);
};

export const adminDeleteAsset = (kind: AssetKind) =>
    http.delete(`/admin/isbn-settings/assets/${kind}`);

export const adminAsset = (kind: AssetKind) =>
    http.fetchFile(`/admin/isbn-settings/assets/${kind}`);

export const adminPreview = () =>
    http.fetchFile('/admin/isbn-settings/preview');
