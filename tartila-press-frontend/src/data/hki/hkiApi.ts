import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type HkiStatus = 'pending' | 'submitted' | 'registered';

export type HkiEntry = {
    key: string;
    subject_type: 'order' | 'book';
    subject_id: number;
    title: string;
    source: string;
    authors: { id: number; name: string }[];
    book_status: string;
    published: boolean;
    date: string | null;
    hki: {
        id: number | null;
        status: HkiStatus;
        status_label: string;
        application_number: string | null;
        registration_number: string | null;
        registered_at: string | null;
        has_certificate: boolean;
        certificate_name: string | null;
        certificate_uploaded_at: string | null;
        note: string | null;
    };
};

export type HkiUpdatePayload = {
    status: HkiStatus;
    application_number: string | null;
    registration_number: string | null;
    registered_at: string | null;
    note: string | null;
};

export type MyHkiCertificate = {
    id: number;
    title: string;
    registration_number: string | null;
    registered_at: string | null;
    file_name: string | null;
    is_pdf: boolean;
    uploaded_at: string | null;
};

// Admin
// Per halaman (bawaan 20): ?status=, ?search=. meta.statuses & meta.counts.
export const adminList = (
    params: { status?: string; search?: string } & PageParams = {}
) => http.get(`/admin/hki${queryString(params)}`);

export const adminUpdate = (
    subjectType: HkiEntry['subject_type'],
    subjectId: number,
    payload: HkiUpdatePayload
) => http.put(`/admin/hki/${subjectType}/${subjectId}`, payload);

export const adminUploadCertificate = (
    subjectType: HkiEntry['subject_type'],
    subjectId: number,
    file: File
) => {
    const formData = new FormData();
    formData.append('file', file);

    return http.upload(
        `/admin/hki/${subjectType}/${subjectId}/certificate`,
        formData
    );
};

export const adminDeleteCertificate = (recordId: number) =>
    http.delete(`/admin/hki/records/${recordId}/certificate`);

export const adminCertificateFile = (recordId: number, inline = false) =>
    http.fetchFile(
        `/admin/hki/records/${recordId}/certificate${inline ? '?inline=1' : ''}`
    );

// Penulis
export const mine = () => http.get('/hki-certificates');

export const myCertificateFile = (recordId: number, inline = false) =>
    http.fetchFile(
        `/hki-certificates/${recordId}/download${inline ? '?inline=1' : ''}`
    );
