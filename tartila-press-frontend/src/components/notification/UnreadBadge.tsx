import type { ReactNode } from 'react';
import { useNotifications, useUnreadCount } from '@/context/useNotifications';

/** Angka merah jumlah notifikasi belum dibaca (tidak tampil kalau 0). */
export function UnreadBadge({
    count,
    className = '',
}: {
    count: number;
    className?: string;
}) {
    if (count <= 0) {
        return null;
    }

    return (
        <span
            className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`}
        >
            {count > 99 ? '99+' : count}
            <span className="sr-only"> belum dibaca</span>
        </span>
    );
}

/** Titik merah di baris daftar yang punya update belum dibaca. */
export function UnreadDot({ label = 'Ada update baru' }: { label?: string }) {
    return (
        <span
            className="inline-block size-2.5 shrink-0 rounded-full bg-red-600 ring-2 ring-white"
            title={label}
        >
            <span className="sr-only">{label}</span>
        </span>
    );
}

/** Label menu dashboard + angka merah untuk kategori notifikasinya. */
export function NavLabel({
    categories,
    total = false,
    children,
}: {
    categories: string[];
    // true: jumlah semua notifikasi belum dibaca (menu "Notifikasi").
    total?: boolean;
    children: ReactNode;
}) {
    const { summary } = useNotifications();
    const categoryCount = useUnreadCount(categories);
    const count = total ? summary.unread_total : categoryCount;

    return (
        <span className="flex items-center justify-between gap-2">
            <span>{children}</span>
            <UnreadBadge count={count} />
        </span>
    );
}
