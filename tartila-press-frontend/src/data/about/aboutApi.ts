import { http } from '@/lib/http';

export type SocialPlatform =
    | 'instagram'
    | 'facebook'
    | 'tiktok'
    | 'youtube'
    | 'x'
    | 'linkedin'
    | 'website';

export type AboutProfile = {
    vision: string | null;
    // Satu misi per baris.
    mission: string | null;
    profile: string | null;
    contact_email: string | null;
    phone: string | null;
    // Kode negara tanpa +, mis. 6281234567890.
    whatsapp: string | null;
    address: string | null;
    // Kata kunci peta (kosong = pakai alamat).
    map_query: string | null;
    social_links: Partial<Record<SocialPlatform, string>>;
    show_team: boolean;
};

export type AboutLegality = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
};

export type AboutTeamMember = {
    id: number;
    name: string;
    photo_url: string | null;
    position: string | null;
    expertise: string | null;
};

export type AboutPage = {
    profile: AboutProfile;
    legalities: AboutLegality[];
    team: AboutTeamMember[];
};

// Admin: anggota tim lengkap dengan status tampil.
export type AdminTeamMember = AboutTeamMember & {
    is_visible: boolean;
    sort_order: number;
};

export type AdminAbout = {
    profile: AboutProfile;
    platforms: SocialPlatform[];
    legalities: (AboutLegality & { sort_order: number })[];
    team: AdminTeamMember[];
};

export type ProfilePayload = Omit<AboutProfile, 'social_links'> & {
    social_links: Partial<Record<SocialPlatform, string>>;
};

export type LegalityPayload = {
    name: string;
    description: string | null;
    image_url: string | null;
};

export type MemberPayload = {
    name: string;
    photo_url: string | null;
    position: string | null;
    expertise: string | null;
    is_visible: boolean;
};

export const get = () => http.get('/about');

export const adminGet = () => http.get('/admin/about');

export const adminUpdateProfile = (payload: ProfilePayload) =>
    http.put('/admin/about', payload);

export const adminCreateLegality = (payload: LegalityPayload) =>
    http.post('/admin/about/legalities', payload);

export const adminUpdateLegality = (id: number, payload: LegalityPayload) =>
    http.put(`/admin/about/legalities/${id}`, payload);

export const adminDeleteLegality = (id: number) =>
    http.delete(`/admin/about/legalities/${id}`);

export const adminOrderLegalities = (ids: number[]) =>
    http.put('/admin/about/legalities/order', { ids });

export const adminCreateMember = (payload: MemberPayload) =>
    http.post('/admin/about/team', payload);

export const adminUpdateMember = (id: number, payload: MemberPayload) =>
    http.put(`/admin/about/team/${id}`, payload);

export const adminDeleteMember = (id: number) =>
    http.delete(`/admin/about/team/${id}`);

export const adminOrderMembers = (ids: number[]) =>
    http.put('/admin/about/team/order', { ids });
