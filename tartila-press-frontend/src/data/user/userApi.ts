import { http } from '@/lib/http';

export const search = (q: string) => http.get(`/users/search?q=${encodeURIComponent(q)}`);
