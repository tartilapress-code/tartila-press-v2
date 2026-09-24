import { useState, type ReactNode } from 'react';
import { RiArrowDownSLine } from '@remixicon/react';

/**
 * Kelompok tautan di menu samping dashboard, bisa dilipat. Di layar lebar
 * dipisah garis tipis dari kelompok di atasnya; di layar sempit (menu
 * mendatar) dipisah garis di kiri.
 */
export function NavGroup({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState<boolean>(true);

    return (
        <div className="flex shrink-0 flex-row items-center gap-1 border-l border-forest-moss-100 pl-2 first:border-l-0 first:pl-0 lg:flex-col lg:items-stretch lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2 lg:first:border-t-0 lg:first:pt-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className="flex flex-row items-center justify-between gap-2 whitespace-nowrap px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-oxford-navy-900/50 transition-colors hover:cursor-pointer hover:text-oxford-navy-700"
            >
                {label}
                <RiArrowDownSLine
                    size={14}
                    aria-hidden
                    className={`transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
            </button>
            {isOpen && (
                <div className="flex flex-row gap-1 lg:flex-col">
                    {children}
                </div>
            )}
        </div>
    );
}
