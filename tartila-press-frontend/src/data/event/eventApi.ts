import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

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
    // Only for registered participants (Event Saya) and admins; the public
    // endpoints leave these out.
    attendance_enabled?: boolean;
    attendance_opens_at?: string | null;
    attendance_closes_at?: string | null;
    attendances_count?: number;
};

/** Attendance status of one registration, as shown in Event Saya. */
export type AttendanceInfo = {
    enabled: boolean;
    state: 'disabled' | 'upcoming' | 'open' | 'closed';
    opens_at: string | null;
    closes_at: string | null;
    submitted: boolean;
    submitted_at: string | null;
    has_certificate_template: boolean;
    certificate_id: number | null;
};

export type EventRegistration = {
    id: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    document_url: string | null;
    order_id: number | null;
    order: { id: number; order_number: string; status: string } | null;
    event: Event;
    attendance_info?: AttendanceInfo;
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

// Per halaman (bawaan 10).
export const list = (params: PageParams = {}) =>
    http.get(`/events${queryString(params)}`);

export const get = (slug: string) => http.get(`/events/${slug}`);

export const mine = () => http.get('/events/mine');

export const register = (
    slug: string,
    payload: { document_url?: string; payment_method_id?: number }
) => http.post(`/events/${slug}/register`, payload);

export const listCategories = () => http.get('/event-categories');

// Per halaman (bawaan 20): ?search= judul.
export const adminList = (params: { search?: string } & PageParams = {}) =>
    http.get(`/admin/events${queryString(params)}`);

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
