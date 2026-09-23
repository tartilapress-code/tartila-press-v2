import { http } from '@/lib/http';

export const list = () => http.get('/book-chapter-projects');

export const get = (id: number | string) =>
    http.get(`/book-chapter-projects/${id}`);
