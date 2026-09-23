import { http } from '@/lib/http';

export const mine = () => http.get('/royalties/mine');
