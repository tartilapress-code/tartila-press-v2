import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    RiArrowDownSLine,
    RiBookOpenLine,
    RiCalendarEventLine,
    RiDashboardLine,
    RiFileList3Line,
    RiShieldUserLine,
    RiShoppingCart2Line,
} from '@remixicon/react';
import { hasAnyRole } from '@/context/AuthContext';
import { useAuth } from '@/context/useAuth';

type MenuItem = { to: string; label: string; icon: ReactNode };

const baseItems: MenuItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <RiDashboardLine /> },
    {
        to: '/dashboard/pesanan',
        label: 'Pesanan Saya',
        icon: <RiFileList3Line />,
    },
    {
        to: '/dashboard/keranjang',
        label: 'Keranjang Buku',
        icon: <RiShoppingCart2Line />,
    },
    { to: '/dashboard/naskah', label: 'Naskah Saya', icon: <RiBookOpenLine /> },
    {
        to: '/dashboard/event-saya',
        label: 'Event Saya',
        icon: <RiCalendarEventLine />,
    },
];

const adminItem: MenuItem = {
    to: '/admin',
    label: 'Panel Admin',
    icon: <RiShieldUserLine />,
};

/**
 * Tombol "Halo, <nama>" di navbar yang membuka pintasan ke dashboard, pesanan,
 * keranjang, dan (untuk admin) panel admin.
 */
export default function UserMenu() {
    const { user } = useAuth();
    const [open, setOpen] = useState<boolean>(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const items = hasAnyRole(user, ['admin'])
        ? [...baseItems, adminItem]
        : baseItems;

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                aria-haspopup="true"
                className="inline-flex h-11 max-w-[11rem] min-[1440px]:max-w-[15rem] items-center gap-2 rounded-lg border border-oxford-navy-700 bg-white px-4 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-forest-moss-50"
            >
                <span className="truncate">Halo, {user?.name}</span>
                <RiArrowDownSLine
                    aria-hidden
                    className={`size-5 shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl border border-forest-moss-100 bg-white p-2 shadow-[0_12px_32px_-12px_rgba(1,26,44,0.35)]">
                    <div className="border-b border-forest-moss-100 px-3 pb-2 pt-1">
                        <p className="truncate text-sm font-semibold text-oxford-navy-900">
                            {user?.name}
                        </p>
                        <p className="truncate text-xs text-oxford-navy-900/55">
                            {user?.email}
                        </p>
                    </div>
                    <ul className="mt-2 flex flex-col gap-0.5">
                        {items.map((item) => (
                            <li key={item.to}>
                                <Link
                                    to={item.to}
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-oxford-navy-900/85 transition-colors hover:bg-forest-moss-50 hover:text-oxford-navy-700"
                                >
                                    <span
                                        aria-hidden
                                        className="text-oxford-navy-700 [&>svg]:size-5"
                                    >
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
