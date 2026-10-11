import { useContext } from 'react';
import {
    NotificationContext,
    type NotificationContextValue,
} from '@/context/NotificationContext';

export function useNotifications(): NotificationContextValue {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            'useNotifications must be used within a NotificationProvider'
        );
    }

    return context;
}

/** Jumlah notifikasi belum dibaca untuk kategori-kategori menu. */
export function useUnreadCount(categories: string[]): number {
    const { summary } = useNotifications();

    return categories.reduce(
        (total, category) => total + (summary.by_category[category] ?? 0),
        0
    );
}

/** Id objek (mis. naskah) yang punya update belum dibaca → titik merah per baris. */
export function useUnreadSubjects(subjectType: string): Set<number> {
    const { summary, recentSubjects } = useNotifications();

    return new Set([
        ...(summary.subjects[subjectType] ?? []),
        ...(recentSubjects[subjectType] ?? []),
    ]);
}
