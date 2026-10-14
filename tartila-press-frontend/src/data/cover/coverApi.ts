import { http } from '@/lib/http';
import { queryString, type PageMeta } from '@/lib/pagination';

export type CoverStatus =
    'awaiting_upload' | 'voting' | 'revision' | 'approved';

export const STATUS_LABEL: Record<CoverStatus, string> = {
    awaiting_upload: 'Menunggu unggahan cover',
    voting: 'Penulis sedang memilih',
    revision: 'Perlu revisi admin',
    approved: 'Disetujui (layak terbit)',
};

export const ACTION_LABEL: Record<string, string> = {
    created: 'Tagihan cover dibuat',
    urgent: 'Naskah gabungan siap — cover mendesak',
    uploaded: 'Admin mengunggah cover',
    voting_opened: 'Pemilihan cover dibuka',
    revision_requested: 'Catatan revisi cover',
    revised: 'Admin mengunggah revisi cover',
    redo: 'Cover dibuat ulang',
    decided: 'Admin menetapkan cover',
    approved: 'Cover disetujui',
    published: 'Buku terbit',
    purged: 'Berkas cover & revisi dihapus',
};

export type CoverOption = {
    id: number;
    round: number;
    position: number;
    kind: 'option' | 'revision';
    current: boolean;
    chosen: boolean;
    purged: boolean;
    name: string | null;
    public_url: string | null;
};

export type CoverState = {
    id: number;
    source: 'package' | 'chapter';
    stage: 'early' | 'urgent';
    title: string;
    status: CoverStatus;
    round: number;
    manuscript_id: number | null;
    book_id: number | null;
    voting_opened_at: string | null;
    voting_deadline_at: string | null;
    option_count: number;
    options: CoverOption[];
    authors: { id: number; name: string; voted: boolean }[];
    votes: {
        user_id: number;
        name: string | null;
        cover_id: number | null;
        note: string | null;
    }[];
    my_vote: { cover_id: number | null; note: string | null } | null;
    is_author: boolean;
    can_vote: boolean;
    chosen_cover_id: number | null;
    approved_at: string | null;
    published_at: string | null;
    purge_at: string | null;
    files_purged: boolean;
    front_cover: string | null;
    history: {
        action: string;
        note: string | null;
        by: string | null;
        created_at: string | null;
    }[];
};

export type CoverListItem = {
    id: number;
    source: 'package' | 'chapter';
    stage: 'early' | 'urgent';
    title: string;
    status: CoverStatus;
    round: number;
    uploaded: number;
    needed: number;
    votes: number;
    authors: number;
    voting_deadline_at: string | null;
    manuscript_id: number | null;
    published_at: string | null;
    front_cover: string | null;
    deadline: string | null;
    created_at: string | null;
};

export type BookCoverItem = {
    id: number;
    title: string;
    authors: string | null;
    front_cover: string | null;
    is_chapter: boolean;
    project_id: number | null;
    published_at: string | null;
    purge_at: string | null;
    files_purged: boolean;
};

// ---------------------------------------------------------- penulis --------

export const forManuscript = (
    manuscriptId: number | string
): Promise<{ data: CoverState | null }> =>
    http.get(`/manuscripts/${manuscriptId}/cover`);

export const vote = (
    manuscriptId: number | string,
    coverId: number | null,
    note: string
): Promise<{ data: CoverState; message: string }> =>
    http.post(`/manuscripts/${manuscriptId}/cover/vote`, {
        cover_id: coverId,
        note: note || null,
    });

export const image = (coverId: number): Promise<Blob> =>
    http.downloadBlob(`/covers/${coverId}/image`);

export const download = (coverId: number): Promise<Blob> =>
    http.downloadBlob(`/covers/${coverId}/download`);

// ------------------------------------------------------------- admin -------

export const packages = (search?: string): Promise<{ data: CoverListItem[] }> =>
    http.get(`/admin/covers/packages${queryString({ search })}`);

export const chapters = (search?: string): Promise<{ data: CoverListItem[] }> =>
    http.get(`/admin/covers/chapters${queryString({ search })}`);

export const books = (params: {
    page?: number;
    search?: string;
}): Promise<{ data: BookCoverItem[]; meta: PageMeta }> =>
    http.get(`/admin/covers/books${queryString({ ...params })}`);

export const project = (id: number | string): Promise<{ data: CoverState }> =>
    http.get(`/admin/covers/projects/${id}`);

export const upload = (
    projectId: number,
    file: File,
    position: number
): Promise<{ data: CoverState; message: string }> => {
    const form = new FormData();
    form.append('file', file);
    form.append('position', String(position));

    return http.upload(`/admin/covers/projects/${projectId}/covers`, form);
};

export const uploadRevision = (
    projectId: number,
    file: File
): Promise<{ data: CoverState; message: string }> => {
    const form = new FormData();
    form.append('file', file);

    return http.upload(`/admin/covers/projects/${projectId}/revision`, form);
};

export const removeCover = (
    coverId: number
): Promise<{ data: CoverState; message: string }> =>
    http.delete(`/admin/covers/covers/${coverId}`);

export const decide = (
    projectId: number,
    coverId: number
): Promise<{ data: CoverState; message: string }> =>
    http.post(`/admin/covers/projects/${projectId}/decide`, {
        cover_id: coverId,
    });

export const replaceBookCover = (
    bookId: number,
    file: File
): Promise<{ data: { id: number; front_cover: string }; message: string }> => {
    const form = new FormData();
    form.append('file', file);

    return http.upload(`/admin/covers/books/${bookId}`, form);
};
