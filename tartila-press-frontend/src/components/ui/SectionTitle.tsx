import type { ReactNode } from 'react';

/** Judul seksi serif dengan garis hijau di kiri; `action` di sisi kanan. */
export default function SectionTitle({
    children,
    action,
    id,
}: {
    children: ReactNode;
    action?: ReactNode;
    id?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h2
                id={id}
                className="font-display flex items-center gap-3 text-xl font-bold text-oxford-navy-700 sm:text-2xl"
            >
                <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full bg-forest-moss-600"
                />
                {children}
            </h2>
            {action}
        </div>
    );
}
