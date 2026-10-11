import { createContext } from 'react';
import type {
    MarkReadPayload,
    NotificationSummary,
} from '@/data/notification/notificationApi';

export type NotificationContextValue = {
    summary: NotificationSummary;
    refresh: () => Promise<void>;
    markRead: (payload: MarkReadPayload) => Promise<void>;
    /**
     * Objek yang belum dibaca SEBELUM halaman ini menandai kategorinya
     * dibaca, supaya baris yang baru diperbarui tetap diberi titik merah
     * selama halaman itu dibuka.
     */
    recentSubjects: Record<string, number[]>;
    markCategoriesSeen: (categories: string[], subjectType?: string) => void;
    resetRecentSubjects: () => void;
};

export const NotificationContext =
    createContext<NotificationContextValue | null>(null);
