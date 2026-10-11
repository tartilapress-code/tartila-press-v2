import type { ReactNode } from 'react';
import { useNotifications } from '@/context/useNotifications';
import { UnreadBadge } from '@/components/notification/UnreadBadge';
import { NavGroup } from './DashboardNav';

/**
 * Grup menu yang tertutup sampai diklik dan terbuka sendiri saat salah satu
 * halamannya sedang dibuka. Selama tertutup, angka merah = notifikasi belum
 * dibaca milik menu di dalamnya.
 */
export default function FoldedNavGroup({
    label,
    isActive,
    countsCategory,
    children,
}: {
    label: string;
    // Halaman yang sedang dibuka ada di grup ini → grup terbuka.
    isActive: boolean;
    // Kategori notifikasi yang dihitung untuk angka merah grup ini.
    countsCategory: (category: string) => boolean;
    children: ReactNode;
}) {
    const { summary } = useNotifications();

    const unread = Object.entries(summary.by_category).reduce(
        (total, [category, count]) =>
            countsCategory(category) ? total + count : total,
        0
    );

    return (
        <NavGroup
            // Dipasang ulang saat halaman aktif masuk/keluar grup ini, supaya
            // terbuka/tertutup mengikuti halaman yang dibuka.
            key={isActive ? 'open' : 'closed'}
            label={label}
            defaultOpen={isActive}
            collapsedBadge={<UnreadBadge count={unread} />}
        >
            {children}
        </NavGroup>
    );
}
