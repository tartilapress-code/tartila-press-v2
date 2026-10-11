import { http } from '@/lib/http';
import { queryString, type PageMeta, type PageParams } from '@/lib/pagination';

// MOU distribusi buku: satu MOU per judul, ditandatangani semua penulis.

export type MouStatus = 'pending' | 'signed' | 'completed';
export type MouType = 'regular' | 'chapter';
export type DistributionMode = 'one' | 'all';

export type DistributionOption = {
    key: string;
    name: string;
    description: string;
};

export type MouContent = {
    title: string;
    opening: string;
    distribution_options: DistributionOption[];
    distribution_mode: DistributionMode;
    royalty: { physical: number | null; ebook: number | null };
    royalty_types: { physical: boolean; ebook: boolean };
    first_party_terms: string[];
    second_party_terms: string[];
    closing_terms: string[];
    contact_note: string | null;
};

export type MouSignatory = {
    user_id: number;
    name: string;
    position: number;
    chapters: number | null;
    royalty_physical: number | null;
    royalty_ebook: number | null;
    signed_at: string | null;
    is_me: boolean;
};

export type SignVia = 'isbn' | 'final_review' | 'direct';

export type Mou = {
    id: number;
    type: MouType;
    type_label: string;
    number: string;
    title: string;
    status: MouStatus;
    status_label: string;
    signed_at: string | null;
    customized: boolean;
    manuscript_id: number | null;
    book_id: number | null;
    isbn_application_id: number | null;
    compilation_manuscript_id: number | null;
    content: MouContent;
    distribution_choice: string[];
    publisher: {
        name: string;
        address: string;
        responsible_name: string;
        city: string;
    };
    signatories: MouSignatory[];
    has_final: boolean;
    final_uploaded_at: string | null;
    addenda: {
        id: number;
        title: string;
        note: string | null;
        file_name: string;
        created_at: string | null;
    }[];
    me: {
        signed: boolean;
        signed_at: string | null;
        sign_via: SignVia;
        blocked_reason: string | null;
        chooses_distribution: boolean;
    } | null;
    // Hanya admin: isi template utama untuk perbandingan.
    template_content?: Omit<MouContent, 'royalty_types'>;
};

export type MyMouItem = Pick<
    Mou,
    | 'id'
    | 'type'
    | 'type_label'
    | 'number'
    | 'title'
    | 'status'
    | 'status_label'
    | 'has_final'
    | 'final_uploaded_at'
    | 'me'
    | 'addenda'
    | 'isbn_application_id'
    | 'manuscript_id'
> & {
    mine: MouSignatory | null;
    royalty_types: MouContent['royalty_types'] | null;
};

export const STATUS_CLASS: Record<MouStatus, string> = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    signed: 'bg-oxford-navy-50 text-oxford-navy-800 ring-oxford-navy-200',
    completed: 'bg-forest-moss-50 text-forest-moss-800 ring-forest-moss-200',
};

const signedAtFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

/** Waktu tanda tangan dalam WIB. */
export function formatSignedAt(value: string | null): string {
    return value ? `${signedAtFormatter.format(new Date(value))} WIB` : '';
}

/** "12,5%" — null = tidak berlaku. */
export function percent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';

    return `${Number(value.toFixed(2)).toLocaleString('id-ID')}%`;
}

// --- Penulis ------------------------------------------------------------------

export const mine = (): Promise<{ data: MyMouItem[] }> => http.get('/mous');

export const get = (id: number | string): Promise<{ data: Mou }> =>
    http.get(`/mous/${id}`);

export const sign = (
    id: number,
    signature: string
): Promise<{ data: Mou; message: string }> =>
    http.post(`/mous/${id}/sign`, { agreed: true, signature });

export const pdf = (id: number, inline = false) =>
    http.fetchFile(`/mous/${id}/pdf${inline ? '?inline=1' : ''}`);

export const addendumFile = (id: number, addendumId: number, inline = false) =>
    http.fetchFile(
        `/mous/${id}/addenda/${addendumId}${inline ? '?inline=1' : ''}`
    );

// --- Admin --------------------------------------------------------------------

export type MouTemplate = {
    id: number;
    category: MouType;
    title: string;
    opening: string;
    distribution_options: DistributionOption[];
    distribution_mode: DistributionMode;
    physical_royalty: number;
    ebook_royalty: number;
    first_party_terms: string[];
    second_party_terms: string[];
    closing_terms: string[];
    contact_note: string | null;
};

export type MouTemplateInput = Omit<MouTemplate, 'id' | 'category'>;

export const adminTemplate = (
    category: MouType
): Promise<{ data: MouTemplate }> =>
    http.get(`/admin/mou-templates/${category}`);

export const adminSaveTemplate = (
    category: MouType,
    data: MouTemplateInput
): Promise<{ data: MouTemplate; message: string }> =>
    http.put(`/admin/mou-templates/${category}`, data);

export const adminResetTemplate = (
    category: MouType
): Promise<{ data: MouTemplate; message: string }> =>
    http.post(`/admin/mou-templates/${category}/reset`);

export const adminPreviewTemplate = (category: MouType) =>
    http.fetchFile(`/admin/mou-templates/${category}/preview`);

export type AdminMouRow = {
    id: number;
    type: MouType;
    number: string;
    title: string;
    status: MouStatus;
    status_label: string;
    customized: boolean;
    signed_count: number;
    signatories_count: number;
    authors: string[];
    has_final: boolean;
    created_at: string | null;
};

export const adminList = (
    params: PageParams & { status?: string; type?: string; search?: string }
): Promise<{
    data: AdminMouRow[];
    meta: PageMeta & { counts?: Record<string, number> };
}> => http.get(`/admin/mous${queryString(params)}`);

export const adminGet = (id: number | string): Promise<{ data: Mou }> =>
    http.get(`/admin/mous/${id}`);

export type MouCustomInput = Omit<MouContent, 'royalty' | 'royalty_types'> & {
    royalty_types: MouContent['royalty_types'];
    royalty_pool: { physical: number | null; ebook: number | null };
    royalties: { user_id: number; physical: number; ebook: number }[];
    distribution_choice: string[] | null;
    reset_signatures?: boolean;
};

export const adminUpdate = (
    id: number,
    data: MouCustomInput
): Promise<{ data: Mou; message: string }> =>
    http.put(`/admin/mous/${id}`, data);

export const adminResetToTemplate = (
    id: number
): Promise<{ data: Mou; message: string }> =>
    http.post(`/admin/mous/${id}/reset-template`);

export const adminPdf = (id: number, inline = false) =>
    http.fetchFile(`/admin/mous/${id}/pdf${inline ? '?inline=1' : ''}`);

export const adminUploadFinal = (
    id: number,
    file: File
): Promise<{ data: Mou; message: string }> => {
    const form = new FormData();
    form.append('file', file);

    return http.upload(`/admin/mous/${id}/final`, form);
};

export const adminFinalPdf = (id: number, inline = false) =>
    http.fetchFile(`/admin/mous/${id}/final${inline ? '?inline=1' : ''}`);

export const adminDeleteFinal = (
    id: number
): Promise<{ data: Mou; message: string }> =>
    http.delete(`/admin/mous/${id}/final`);

export const adminAddAddendum = (
    id: number,
    data: { title: string; note?: string; file: File }
): Promise<{ data: Mou; message: string }> => {
    const form = new FormData();
    form.append('title', data.title);
    if (data.note) form.append('note', data.note);
    form.append('file', data.file);

    return http.upload(`/admin/mous/${id}/addenda`, form);
};

export const adminAddendumFile = (
    id: number,
    addendumId: number,
    inline = false
) =>
    http.fetchFile(
        `/admin/mous/${id}/addenda/${addendumId}${inline ? '?inline=1' : ''}`
    );

export const adminDeleteAddendum = (
    id: number,
    addendumId: number
): Promise<{ data: Mou; message: string }> =>
    http.delete(`/admin/mous/${id}/addenda/${addendumId}`);
