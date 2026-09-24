import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine } from '@remixicon/react';
import SectionTitle from '@/components/ui/SectionTitle';

export interface TitleProps {
    children: React.ReactNode;
    // Keterangan singkat di bawah judul.
    subtitle?: string;
    // Tautan "Lihat semua" di kanan judul.
    action?: { to: string; label: string };
}

/** Judul seksi beranda: judul serif berpenanda hijau, keterangan, dan tautan. */
export default function Title({
    children,
    subtitle,
    action,
}: TitleProps): ReactNode {
    return (
        <div className="flex flex-col gap-2">
            <SectionTitle
                action={
                    action && (
                        <Link
                            to={action.to}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-oxford-navy-700 hover:underline"
                        >
                            {action.label}
                            <RiArrowRightLine aria-hidden className="size-4" />
                        </Link>
                    )
                }
            >
                {children}
            </SectionTitle>
            {subtitle && (
                <p className="max-w-2xl pl-4 text-[15px] leading-relaxed text-oxford-navy-900/65">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
