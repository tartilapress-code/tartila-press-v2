import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type ProjectListParams = Partial<{
    search: string;
    category: string;
    sort: 'newest' | 'deadline' | 'price' | 'slots';
}> &
    PageParams;

// Per halaman (bawaan 12); meta.categories = semua kategori proyek terbuka.
export const list = (params: ProjectListParams = {}) =>
    http.get(`/book-chapter-projects${queryString(params)}`);

export const get = (id: number | string) =>
    http.get(`/book-chapter-projects/${id}`);
