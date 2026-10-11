import { http } from '@/lib/http';

export const submit = (formData: FormData) =>
    http.upload('/manuscripts', formData);

export const mine = () => http.get('/manuscripts/mine');

export const show = (id: number | string) => http.get(`/manuscripts/${id}`);

export const addRevision = (id: number | string, formData: FormData) =>
    http.upload(`/manuscripts/${id}/revisions`, formData);

export const finalReview = (
    id: number | string,
    payload: {
        decision: 'approve' | 'revise';
        note?: string;
        // Book Chapter: MOU disetujui saat menyetujui naskah akhir.
        mou_agreed?: boolean;
        signature?: string;
    }
) => http.post(`/manuscripts/${id}/final-review`, payload);

// --- Book Chapter: naskah gabungan --------------------------------------------

export type ChapterRevisionRequest = {
    id: number;
    note: string;
    requested_by: string | null;
    created_at: string;
    resolved_at: string | null;
};

export type CompilationChapter = {
    id: number;
    chapter_number: number;
    title: string;
    manuscript: {
        id: number;
        status: string;
        author: string | null;
        revisions: {
            id: number;
            revision_number: number;
            original_filename: string;
            admin_status: 'pending' | 'approved' | 'rejected';
            created_at: string;
        }[];
        revision_requests: ChapterRevisionRequest[];
    } | null;
};

/** Naskah awal per bab dari naskah gabungan (editor & admin). */
export const compilationChapters = (id: number | string) =>
    http.get(`/manuscripts/${id}/compilation-chapters`);

/** Catatan revisi untuk satu bab, dikirim ke penulis bab tersebut. */
export const requestChapterRevision = (
    id: number | string,
    chapterManuscriptId: number,
    note: string
) =>
    http.post(
        `/manuscripts/${id}/compilation-chapters/${chapterManuscriptId}/revision-request`,
        { note }
    );

export const downloadRevision = (
    manuscriptId: number | string,
    revisionId: number | string
) =>
    http.downloadBlob(
        `/manuscripts/${manuscriptId}/revisions/${revisionId}/download`
    );
