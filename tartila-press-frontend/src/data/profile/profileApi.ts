import { http } from '@/lib/http';

export type UpdateProfilePayload = Partial<{
    name: string;
    education_level: string;
    institution: string;
    age: string | number;
    gender: string;
    occupation: string;
    nik: string;
    ktp_address: string;
    domicile_address: string;
    birth_place: string;
    birth_date: string;
    phone: string;
}>;

export type ChangePasswordPayload = {
    current_password: string;
    password: string;
    password_confirmation: string;
};

export type RequestEmailChangePayload = {
    email: string;
    current_password: string;
};

export const getProfile = () => http.get('/auth/profile');

export const updateProfile = (payload: UpdateProfilePayload) =>
    http.patch('/auth/profile', payload);

export const changePassword = (payload: ChangePasswordPayload) =>
    http.post('/auth/change-password', payload);

export const requestEmailChange = (payload: RequestEmailChangePayload) =>
    http.post('/auth/change-email', payload);
