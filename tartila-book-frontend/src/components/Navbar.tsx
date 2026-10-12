import { isApp } from '@/lib/platform';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/Button';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/auth';

const PRESS_URL = import.meta.env.VITE_PRESS_URL as string;

const LINKS = [
    { to: '/', label: 'Beranda', end: true },
    { to: '/katalog', label: 'Katalog' },
    // Aplikasi hanya untuk masuk & membaca: langganan dikelola di situs web.
    ...(isApp ? [] : [{ to: '/langganan', label: 'Langganan' }]),
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-[15px] transition-colors ${
        isActive
            ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
            : 'font-medium text-oxford-navy-900/80 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
    }`;

function Bell({ unread }: { unread: number }) {
    return (
        <Link
            to="/notifikasi"
            aria-label={
                unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'
            }
            className="relative inline-flex size-10 items-center justify-center rounded-full text-oxford-navy-700 transition-colors hover:bg-forest-moss-50"
        >
            <i aria-hidden className="ri-notification-3-line text-xl" />
            {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
                    {unread > 99 ? '99+' : unread}
                </span>
            )}
        </Link>
    );
}

function UserMenu() {
    const { user, isAdmin, logout } = useAuth();
    const [open, setOpen] = useState<boolean>(false);
    const ref = useRef<HTMLDivElement>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        const timer = window.setTimeout(() => setOpen(false), 0);

        return () => window.clearTimeout(timer);
    }, [pathname]);

    useEffect(() => {
        if (!open) return;

        const close = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);

        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const item =
        'block rounded-lg px-3 py-2 text-sm text-oxford-navy-900/85 hover:bg-forest-moss-50 hover:text-oxford-navy-700';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="flex h-10 max-w-48 items-center gap-2 rounded-full bg-forest-moss-50 px-3 text-sm font-semibold text-oxford-navy-700 ring-1 ring-forest-moss-200 hover:cursor-pointer hover:bg-forest-moss-100"
            >
                <i aria-hidden className="ri-user-3-line text-lg" />
                <span className="truncate">{user?.name}</span>
                <i aria-hidden className="ri-arrow-down-s-line" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="card-shadow absolute right-0 z-50 mt-2 flex w-60 flex-col gap-0.5 rounded-xl bg-white p-2 ring-1 ring-forest-moss-100"
                >
                    <Link to="/rak" role="menuitem" className={item}>
                        Rak Saya
                    </Link>
                    {!isApp && (
                        <Link to="/pesanan" role="menuitem" className={item}>
                            Pembelian & Langganan
                        </Link>
                    )}
                    <Link to="/royalti" role="menuitem" className={item}>
                        Royalti Baca (penulis)
                    </Link>
                    {isAdmin && !isApp && (
                        <Link to="/admin" role="menuitem" className={item}>
                            Panel Admin
                        </Link>
                    )}
                    <a href={PRESS_URL} role="menuitem" className={item}>
                        Ke Tartila Press ↗
                    </a>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void logout()}
                        className="mt-1 rounded-lg bg-forest-moss-600 px-3 py-2 text-left text-sm font-semibold text-white hover:cursor-pointer hover:bg-forest-moss-700"
                    >
                        Keluar
                    </button>
                </div>
            )}
        </div>
    );
}

/** Navbar putih Tartila Book (gaya sama dengan Tartila Press): menu, pencarian, notifikasi, akun. */
export default function Navbar() {
    const { user, unread } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [query, setQuery] = useState<string>('');
    const [menu, setMenu] = useState<boolean>(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setMenu(false), 0);

        return () => window.clearTimeout(timer);
    }, [pathname]);

    function search(event: FormEvent) {
        event.preventDefault();
        const q = query.trim();
        navigate(q ? `/katalog?q=${encodeURIComponent(q)}` : '/katalog');
    }

    return (
        <header className="sticky top-0 z-40 border-b border-forest-moss-100 bg-white/95 backdrop-blur">
            <nav
                aria-label="Menu utama"
                className="mx-auto flex h-[4.5rem] max-w-[1232px] items-center justify-between gap-4 px-4 sm:px-8"
            >
                <Logo hideSlogan className="shrink-0" />

                <div className="hidden items-center gap-1 lg:flex">
                    {LINKS.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={linkClass}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    {user && (
                        <NavLink to="/rak" className={linkClass}>
                            Rak Saya
                        </NavLink>
                    )}
                </div>

                <form
                    onSubmit={search}
                    role="search"
                    className="hidden min-w-0 flex-1 md:block md:max-w-xs"
                >
                    <label className="relative block">
                        <span className="sr-only">Cari buku</span>
                        <i
                            aria-hidden
                            className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-oxford-navy-900/50"
                        />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari judul atau penulis"
                            className="h-10 w-full rounded-full border border-forest-moss-200 bg-forest-moss-50/60 pl-9 pr-3 text-sm text-oxford-navy-900 outline-none placeholder:text-oxford-navy-900/45 focus:border-forest-moss-500 focus:bg-white"
                        />
                    </label>
                </form>

                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            <Bell unread={unread} />
                            <div className="hidden sm:block">
                                <UserMenu />
                            </div>
                        </>
                    ) : (
                        <div className="hidden items-center gap-2 sm:flex">
                            <Link to="/masuk">
                                <Button
                                    variant="outline2"
                                    className="h-11 whitespace-nowrap"
                                >
                                    Masuk
                                </Button>
                            </Link>
                            <a href={`${PRESS_URL}/register`}>
                                <Button
                                    variant="secondary"
                                    className="h-11 whitespace-nowrap"
                                >
                                    Daftar
                                </Button>
                            </a>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setMenu((value) => !value)}
                        aria-expanded={menu}
                        aria-controls="menu-mobile"
                        aria-label={menu ? 'Tutup menu' : 'Buka menu'}
                        className="inline-flex size-10 items-center justify-center rounded-full text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50 lg:hidden"
                    >
                        <i
                            aria-hidden
                            className={`${menu ? 'ri-close-line' : 'ri-menu-line'} text-2xl`}
                        />
                    </button>
                </div>
            </nav>

            {menu && (
                <div
                    id="menu-mobile"
                    className="flex max-h-[calc(100dvh-4.5rem)] flex-col gap-1 overflow-y-auto border-t border-forest-moss-100 bg-white px-4 pb-5 pt-3 sm:px-8 lg:hidden"
                >
                    <form onSubmit={search} role="search" className="mb-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Cari buku"
                            placeholder="Cari judul atau penulis"
                            className="h-11 w-full rounded-full border border-forest-moss-200 bg-forest-moss-50/60 px-4 text-sm outline-none focus:border-forest-moss-500"
                        />
                    </form>
                    {[
                        ...LINKS,
                        ...(user
                            ? [{ to: '/rak', label: 'Rak Saya', end: false }]
                            : []),
                    ].map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={linkClass}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    {user ? (
                        <UserMenuInline />
                    ) : (
                        <div className="mt-2 flex gap-2 border-t border-forest-moss-100 pt-4">
                            <Link to="/masuk">
                                <Button variant="outline2">Masuk</Button>
                            </Link>
                            <a href={`${PRESS_URL}/register`}>
                                <Button variant="secondary">Daftar</Button>
                            </a>
                        </div>
                    )}
                </div>
            )}
        </header>
    );
}

/** Menu akun versi daftar untuk layar kecil. */
function UserMenuInline() {
    const { user, isAdmin, logout } = useAuth();
    const item =
        'rounded-full px-3 py-2 text-[15px] font-medium text-oxford-navy-900/80 hover:bg-forest-moss-50';

    return (
        <div className="mt-2 flex flex-col gap-1 border-t border-forest-moss-100 pt-3">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-oxford-navy-900/60">
                {user?.name}
            </p>
            {!isApp && (
                <Link to="/pesanan" className={item}>
                    Pembelian & Langganan
                </Link>
            )}
            <Link to="/royalti" className={item}>
                Royalti Baca (penulis)
            </Link>
            {isAdmin && !isApp && (
                <Link to="/admin" className={item}>
                    Panel Admin
                </Link>
            )}
            <a href={PRESS_URL} className={item}>
                Ke Tartila Press ↗
            </a>
            <Button
                variant="secondary"
                className="mt-2 self-start"
                onClick={() => void logout()}
            >
                Keluar
            </Button>
        </div>
    );
}
