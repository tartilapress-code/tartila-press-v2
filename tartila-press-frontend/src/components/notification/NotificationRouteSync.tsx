import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '@/context/useNotifications';

/**
 * Halaman yang membuat notifikasi kategorinya otomatis terbaca saat dibuka.
 * Naskah TIDAK ada di sini: titik merah per naskah hilang ketika naskahnya
 * dibuka (lihat SUBJECT_PAGES).
 */
const CATEGORY_PAGES: Record<
    string,
    { categories: string[]; subject?: string }
> = {
    '/dashboard/akun': { categories: ['role'] },
    '/dashboard/buku-terbit': { categories: ['book'] },
    '/dashboard/pesanan': { categories: ['order'], subject: 'order' },
    '/dashboard/dompet': { categories: ['wallet'] },
    '/dashboard/voucher-saya': { categories: ['voucher'] },
    '/dashboard/artikel-saya': { categories: ['article'] },
    '/dashboard/event-saya': { categories: ['event'] },
    '/dashboard/sertifikat-saya': { categories: ['certificate'] },
    '/dashboard/pool-naskah': { categories: ['pool'] },
    '/admin': { categories: ['admin_role'] },
    '/admin/orders': { categories: ['admin_order'], subject: 'order' },
    '/admin/withdrawals': { categories: ['admin_withdrawal'] },
    '/admin/terbitkan-naskah': { categories: ['admin_isbn'] },
    '/admin/mou': { categories: ['admin_mou'] },
    '/dashboard/royalti': { categories: ['mou'] },
    '/admin/articles': { categories: ['admin_article'] },
};

/** Halaman detail: notifikasi objek itu terbaca saat dibuka. */
const SUBJECT_PAGES: { pattern: RegExp; subject: string }[] = [
    { pattern: /^\/dashboard\/naskah\/(\d+)$/, subject: 'manuscript' },
    { pattern: /^\/dashboard\/isbn\/(\d+)$/, subject: 'isbn' },
    { pattern: /^\/dashboard\/mou\/(\d+)$/, subject: 'mou' },
];

export default function NotificationRouteSync() {
    const { pathname } = useLocation();
    const { summary, markRead, markCategoriesSeen, resetRecentSubjects } =
        useNotifications();

    const page = CATEGORY_PAGES[pathname.replace(/\/+$/, '') || '/'];
    const pageUnread = page
        ? page.categories.reduce(
              (total, category) => total + (summary.by_category[category] ?? 0),
              0
          )
        : 0;

    const detail = SUBJECT_PAGES.map(({ pattern, subject }) => {
        const match = pathname.match(pattern);

        return match ? { subject, id: Number(match[1]) } : null;
    }).find((item) => item !== null);
    const detailUnread = detail
        ? (summary.subjects[detail.subject] ?? []).includes(detail.id)
        : false;

    // Pindah halaman: titik merah "baru dibaca" dari halaman sebelumnya hilang.
    useEffect(() => {
        resetRecentSubjects();
    }, [pathname, resetRecentSubjects]);

    useEffect(() => {
        if (page && pageUnread > 0) {
            markCategoriesSeen(page.categories, page.subject);
        }
        // Dijalankan saat pindah halaman atau ada notifikasi baru di halaman ini.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, pageUnread]);

    useEffect(() => {
        if (detail && detailUnread) {
            void markRead({
                subject_type: detail.subject,
                subject_id: detail.id,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, detailUnread]);

    return null;
}
