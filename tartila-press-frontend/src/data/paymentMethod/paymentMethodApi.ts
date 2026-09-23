import { http } from '@/lib/http';

export const list = () => http.get('/payment-methods');
