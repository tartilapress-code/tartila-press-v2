import { http } from '@/lib/http';

export type RegisterPayload = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    education_level: string;
    institution?: string;
    age: string;
    gender: string;
    occupation: string;
    phone: string;
};

export type LoginPayload = {
    email: string;
    password: string;
};

export const register = (payload: RegisterPayload) =>
    http.post('/auth/register', payload);

export const login = (payload: LoginPayload) =>
    http.post('/auth/login', payload);

export const logout = () => http.post('/auth/logout');

export const me = () => http.get('/auth/me');
