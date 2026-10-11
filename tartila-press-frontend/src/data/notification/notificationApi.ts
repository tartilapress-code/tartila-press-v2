import { http } from '@/lib/http';

export type AppNotification = {
    id: number;
    category: string;
    title: string;
    body: string | null;
    link: string | null;
    subject_type: string | null;
    subject_id: number | null;
    read_at: string | null;
    created_at: string;
};

export type NotificationSummary = {
    unread_total: number;
    by_category: Record<string, number>;
    // Objek yang punya update belum dibaca, mis. { manuscript: [12, 15] }.
    subjects: Record<string, number[]>;
};

export type MarkReadPayload =
    | { ids: number[] }
    | { categories: string[] }
    | { subject_type: string; subject_id: number }
    | { all: true };

export const summary = () => http.get('/notifications/summary');

export const list = (page = 1, perPage = 20) =>
    http.get(`/notifications?page=${page}&per_page=${perPage}`);

export const markRead = (payload: MarkReadPayload) =>
    http.post('/notifications/read', payload);

export const EMPTY_SUMMARY: NotificationSummary = {
    unread_total: 0,
    by_category: {},
    subjects: {},
};
