import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useAuth } from '@/context/useAuth';
import { NotificationContext } from '@/context/NotificationContext';
import * as notificationApi from '@/data/notification/notificationApi';

const POLL_MS = 60_000;

/**
 * Ringkasan notifikasi belum dibaca untuk lonceng dan tanda merah di menu.
 * Diperbarui tiap menit, saat tab dibuka lagi, dan setelah menandai dibaca.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [summary, setSummary] = useState<notificationApi.NotificationSummary>(
        notificationApi.EMPTY_SUMMARY
    );
    const [recentSubjects, setRecentSubjects] = useState<
        Record<string, number[]>
    >({});
    const summaryRef = useRef(summary);
    // Beberapa permintaan bisa berjalan bersamaan; hanya jawaban permintaan
    // TERAKHIR yang dipakai supaya angka lama tidak menimpa yang baru.
    const requestRef = useRef(0);

    const fetchSummary = useCallback(() => {
        const request = ++requestRef.current;

        return notificationApi
            .summary()
            .then((response) => {
                if (request !== requestRef.current) {
                    return;
                }

                summaryRef.current = response.data;
                setSummary(response.data);
            })
            .catch(() => {
                // Gagal mengambil (mis. offline/token habis): pakai data terakhir.
            });
    }, []);

    const refresh = fetchSummary;

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void fetchSummary();
        const timer = window.setInterval(() => void refresh(), POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void refresh();
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [isAuthenticated, fetchSummary, refresh]);

    const markRead = useCallback(
        async (payload: notificationApi.MarkReadPayload) => {
            try {
                await notificationApi.markRead(payload);
            } finally {
                await refresh();
            }
        },
        [refresh]
    );

    const markCategoriesSeen = useCallback(
        (categories: string[], subjectType?: string) => {
            const current = summaryRef.current;
            const hasUnread = categories.some(
                (category) => (current.by_category[category] ?? 0) > 0
            );

            if (!hasUnread) {
                return;
            }

            // Simpan id objek yang tadinya belum dibaca (mis. pesanan) untuk
            // titik merah per baris selama halaman ini dibuka.
            if (subjectType) {
                setRecentSubjects((previous) => ({
                    ...previous,
                    [subjectType]: [
                        ...(previous[subjectType] ?? []),
                        ...(current.subjects[subjectType] ?? []),
                    ],
                }));
            }

            void markRead({ categories });
        },
        [markRead]
    );

    const resetRecentSubjects = useCallback(() => setRecentSubjects({}), []);

    return (
        <NotificationContext.Provider
            value={{
                summary: isAuthenticated
                    ? summary
                    : notificationApi.EMPTY_SUMMARY,
                refresh,
                markRead,
                recentSubjects,
                markCategoriesSeen,
                resetRecentSubjects,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}
