import { http } from '@/lib/http';

export type EventCategory = { id: number; name: string };

export type Event = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    category: EventCategory | null;
    banner: string | null;
    starts_at: string;
    ends_at: string | null;
    registration_deadline: string | null;
    requires_document: boolean;
    requires_meet_link: boolean;
    meet_link?: string | null;
    youtube_url: string | null;
    certificate_url?: string | null;
    fee: string;
    is_active: boolean;
    confirmed_registrations_count: number;
};

export type EventRegistration = {
    id: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    document_url: string | null;
    order_id: number | null;
    order: { id: number; order_number: string; status: string } | null;
    event: Event;
    created_at: string;
};

export type CreateEventPayload = Partial<{
    title: string;
    description: string;
    event_category_id: number | string;
    banner: string;
    starts_at: string;
    ends_at: string | null;
    registration_deadline: string | null;
    requires_document: boolean;
    requires_meet_link: boolean;
    meet_link: string;
    youtube_url: string;
    certificate_url: string;
    fee: number | string;
    is_active: boolean;
}>;

export const list = () => http.get('/events');

export const get = (slug: string) => http.get(`/events/${slug}`);

export const mine = () => http.get('/events/mine');

export const register = (slug: string, payload: { document_url?: string }) =>
    http.post(`/events/${slug}/register`, payload);

export const listCategories = () => http.get('/event-categories');

export const adminList = () => http.get('/admin/events');

export const adminCreate = (payload: CreateEventPayload) =>
    http.post('/admin/events', payload);

export const adminUpdate = (id: number, payload: CreateEventPayload) =>
    http.patch(`/admin/events/${id}`, payload);

export const adminDelete = (id: number) => http.delete(`/admin/events/${id}`);

export const adminCreateCategory = (name: string) =>
    http.post('/admin/event-categories', { name });

export const adminUpdateCategory = (id: number, name: string) =>
    http.patch(`/admin/event-categories/${id}`, { name });

export const adminDeleteCategory = (id: number) =>
    http.delete(`/admin/event-categories/${id}`);
