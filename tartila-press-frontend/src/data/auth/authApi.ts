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

export const resendVerificationEmail = () =>
    http.post('/auth/email/verification-notification');

export type ResetPasswordPayload = {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
};

export const forgotPassword = (email: string) =>
    http.post('/auth/forgot-password', { email });

export const resetPassword = (payload: ResetPasswordPayload) =>
    http.post('/auth/reset-password', payload);
