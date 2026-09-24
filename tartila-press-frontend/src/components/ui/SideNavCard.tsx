import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightSLine } from '@remixicon/react';

export type SideNavItem = {
    key: string;
    label: string;
    icon: ReactNode;
    active?: boolean;
    // Isi salah satu: `to` = pindah halaman, `onSelect` = aksi di halaman ini.
    to?: string;
    onSelect?: () => void;
};

function rowClass(active: boolean) {
    return `group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors lg:w-full ${
        active
            ? 'bg-forest-moss-100 text-oxford-navy-700'
            : 'text-oxford-navy-900/80 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
    }`;
}

function RowContent({ item }: { item: SideNavItem }) {
    return (
        <>
            <span aria-hidden className="text-oxford-navy-700 [&>svg]:size-5">
                {item.icon}
            </span>
            <span className="lg:flex-1">{item.label}</span>
            <RiArrowRightSLine
                aria-hidden
                className="hidden size-4 text-oxford-navy-700/70 transition-transform group-hover:translate-x-0.5 lg:block"
            />
        </>
    );
}

/**
 * Kartu navigasi samping. Di layar sempit menjadi deretan tombol yang bisa
 * digeser ke samping (tanpa scrollbar).
 */
export default function SideNavCard({
    items,
    ariaLabel,
}: {
    items: SideNavItem[];
    ariaLabel: string;
}) {
    return (
        <nav
            aria-label={ariaLabel}
            className="flex flex-row gap-2 overflow-x-auto rounded-2xl border border-forest-moss-100 bg-white p-2 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] [scrollbar-width:none] lg:flex-col lg:gap-1.5 lg:overflow-visible lg:p-3 [&::-webkit-scrollbar]:hidden"
        >
            {items.map((item) =>
                item.to ? (
                    <Link
                        key={item.key}
                        to={item.to}
                        aria-current={item.active ? 'page' : undefined}
                        className={rowClass(Boolean(item.active))}
                    >
                        <RowContent item={item} />
                    </Link>
                ) : (
                    <button
                        key={item.key}
                        type="button"
                        onClick={item.onSelect}
                        aria-current={item.active ? 'true' : undefined}
                        className={`${rowClass(Boolean(item.active))} hover:cursor-pointer`}
                    >
                        <RowContent item={item} />
                    </button>
                )
            )}
        </nav>
    );
}
