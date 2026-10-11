import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type SocialBook = {
    id: number;
    title: string;
    authors: string[];
    isbn: string | null;
    price: number;
    final_price: number;
    description: string | null;
    url: string;
    has_cover: boolean;
    is_chapter_compilation: boolean;
};

// Per halaman (bawaan 24, terbaru dulu): ?search= judul/penulis.
export const books = (params: { search?: string } & PageParams = {}) =>
    http.get(`/admin/social/books${queryString(params)}`);

/** Foto cover lewat domain API (supaya kanvas bisa diekspor). */
export const cover = (bookId: number) =>
    http.fetchFile(`/admin/social/books/${bookId}/cover`);
