import { http } from '@/lib/http';

export const submit = (formData: FormData) =>
    http.upload('/manuscripts', formData);

export const mine = () => http.get('/manuscripts/mine');

export const show = (id: number | string) => http.get(`/manuscripts/${id}`);

export const addRevision = (id: number | string, formData: FormData) =>
    http.upload(`/manuscripts/${id}/revisions`, formData);

export const finalReview = (
    id: number | string,
    payload: { decision: 'approve' | 'revise'; note?: string }
) => http.post(`/manuscripts/${id}/final-review`, payload);

export const downloadRevision = (
    manuscriptId: number | string,
    revisionId: number | string
) => http.downloadBlob(`/manuscripts/${manuscriptId}/revisions/${revisionId}/download`);
