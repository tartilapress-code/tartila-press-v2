import { http } from '@/lib/http';

export type UpsertPublicProfilePayload = Partial<{
    pen_name: string;
    bio: string;
    profile_photo: string;
    is_published: boolean;
}>;

export type ExperiencePayload = Partial<{
    title: string;
    description: string;
    year: number;
    sort_order: number;
}>;

export const getMine = () => http.get('/auth/public-profile');

export const upsert = (payload: UpsertPublicProfilePayload) =>
    http.post('/auth/public-profile', payload);

export const listExperiences = () =>
    http.get('/auth/public-profile/experiences');

export const createExperience = (payload: ExperiencePayload) =>
    http.post('/auth/public-profile/experiences', payload);

export const updateExperience = (id: number, payload: ExperiencePayload) =>
    http.patch(`/auth/public-profile/experiences/${id}`, payload);

export const deleteExperience = (id: number) =>
    http.delete(`/auth/public-profile/experiences/${id}`);

export const getBySlug = (slug: string) => http.get(`/public/authors/${slug}`);

export const listByRole = (role: 'penulis' | 'editor') =>
    http.get(`/public/authors?role=${role}`);
