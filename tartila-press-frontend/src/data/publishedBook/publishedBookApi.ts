import { http } from '@/lib/http';
import type { HkiStatus } from '@/data/hki/hkiApi';

export type MyPublishedBook = {
    id: number;
    title: string;
    slug: string;
    authors: string;
    front_cover: string | null;
    isbn: string | null;
    published_at: string | null;
    category: string | null;
    is_book_chapter: boolean;
    // Ebook lengkap yang diunggah admin (null = belum ada).
    ebook: { name: string | null; uploaded_at: string | null } | null;
    // Null = paket/buku tanpa layanan HKI.
    hki: {
        status: HkiStatus;
        status_label: string;
        registration_number: string | null;
        certificate_id: number | null;
    } | null;
    author_certificate: { id: number; number: string | null } | null;
    author_certificate_note: string | null;
};

export const mine = () => http.get('/my-published-books');

export const ebookFile = (bookId: number) =>
    http.fetchFile(`/my-published-books/${bookId}/ebook`);

// Admin
export const adminUploadEbook = (
    bookId: number,
    file: File,
    pageCount?: number
) => {
    const formData = new FormData();
    formData.append('file', file);

    if (pageCount) {
        formData.append('page_count', String(pageCount));
    }

    return http.upload(`/admin/books/${bookId}/ebook`, formData);
};

export const adminDeleteEbook = (bookId: number) =>
    http.delete(`/admin/books/${bookId}/ebook`);

export const adminEbookFile = (bookId: number) =>
    http.fetchFile(`/admin/books/${bookId}/ebook`);
