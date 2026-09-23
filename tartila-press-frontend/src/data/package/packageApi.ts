import { http } from '@/lib/http';

export const list = () => http.get('/packages');

export const get = (id: number | string) => http.get(`/packages/${id}`);
