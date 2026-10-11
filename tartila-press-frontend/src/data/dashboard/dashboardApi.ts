import { http } from '@/lib/http';
import type { AppNotification } from '@/data/notification/notificationApi';

export type SummaryItem = {
    key: string;
    label: string;
    // Null = bukan angka (mis. pengingat "Data pribadi belum diisi").
    value: number | null;
    format: 'number' | 'currency';
    link: string;
    // Perlu tindakan pengguna.
    attention: boolean;
    hint: string | null;
};

export type SummarySection = {
    key: 'account' | 'writer' | 'editor' | 'wallet' | 'admin';
    title: string;
    items: SummaryItem[];
};

export type DashboardSummary = {
    name: string;
    roles: string[];
    unread_notifications: number;
    sections: SummarySection[];
    updates: Pick<
        AppNotification,
        'id' | 'category' | 'title' | 'body' | 'link' | 'read_at' | 'created_at'
    >[];
};

export const summary = () => http.get('/dashboard/summary');
