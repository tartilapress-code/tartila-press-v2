import { http } from '@/lib/http';

export const list = () => http.get('/custom-package-items');
