import { http } from '@/lib/http';

export type RequestedRole = 'penulis' | 'editor';

export const create = (requestedRole: RequestedRole) =>
    http.post('/role-requests', { requested_role: requestedRole });

export const mine = () => http.get('/role-requests/mine');
