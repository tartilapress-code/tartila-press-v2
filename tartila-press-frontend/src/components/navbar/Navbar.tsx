import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import { RiCloseLargeFill, RiMenuLine } from '@remixicon/react';
import Logo from '../Logo';
import Button from '../Button/Button';
import navlink from '../../data/navlink.json';
import { useAuth } from '@/context/useAuth';
import NavbarSearch from './NavbarSearch';
import UserMenu from './UserMenu';

// Tautan aktif: halaman yang sama (atau turunannya); tautan ke bagian beranda
// ("/#paket") hanya aktif di beranda dengan hash yang sama.
function isActiveLink(target: string, pathname: string, hash: string) {
    const [path, fragment] = target.split('#');

    if (fragment !== undefined) {
        if (pathname !== '/') return false;

        return fragment === 'home'
            ? hash === '' || hash === '#home'
            : hash === `#${fragment}`;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
}

const linkBase =
    'relative block whitespace-nowrap py-2 text-[15px] transition-colors';
const linkState = {
    active: 'font-semibold text-oxford-navy-700',
    idle: 'font-medium text-oxford-navy-900/80 hover:text-oxford-navy-700',
};

export default function Navbar() {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { user, isAuthenticated, logout } = useAuth();
    const { pathname, hash } = useLocation();

    function closeMenu() {
        setIsOpen(false);
    }

    return (
        <header className="sticky top-0 z-50 border-b border-forest-moss-100 bg-white/95 backdrop-blur">
            <nav
                aria-label="Navigasi utama"
                className="flex flex-row items-center justify-between gap-4 px-4 py-2 sm:px-8 xl:px-10 min-[1440px]:py-2.5"
            >
                <Logo
                    size="small"
                    sloganClassName="max-sm:hidden xl:max-[1439px]:hidden"
                />

                <ul className="hidden flex-row items-center gap-x-4 xl:flex min-[1440px]:gap-x-5 2xl:gap-x-7">
                    {navlink.map((menu) => {
                        const active = isActiveLink(menu.links, pathname, hash);

                        return (
                            <li key={menu.id}>
                                <HashLink
                                    to={menu.links}
                                    smooth
                                    aria-current={active ? 'page' : undefined}
                                    className={`${linkBase} ${
                                        active
                                            ? linkState.active
                                            : linkState.idle
                                    }`}
                                >
                                    {menu.label}
                                    {active && (
                                        <span
                                            aria-hidden
                                            className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-forest-moss-600"
                                        />
                                    )}
                                </HashLink>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex flex-row items-center gap-2 sm:gap-3">
                    <NavbarSearch />
                    <span
                        aria-hidden
                        className="hidden h-8 w-px bg-forest-moss-200 xl:block"
                    />

                    {isAuthenticated ? (
                        <div className="hidden flex-row items-center gap-3 xl:flex">
                            <UserMenu />
                            <Button
                                variant="secondary"
                                className="h-11"
                                onClick={() => logout()}
                            >
                                Logout
                            </Button>
                        </div>
                    ) : (
                        <div className="hidden flex-row items-center gap-2 xl:flex">
                            <Link to="/login">
                                <Button variant="outline2" className="h-11">
                                    Login
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button variant="secondary" className="h-11">
                                    Register
                                </Button>
                            </Link>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsOpen((previous) => !previous)}
                        className="inline-flex size-10 items-center justify-center rounded-full text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-forest-moss-50 xl:hidden"
                        aria-expanded={isOpen}
                        aria-controls="menu-mobile"
                        aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
                    >
                        {isOpen ? (
                            <RiCloseLargeFill aria-hidden className="size-6" />
                        ) : (
                            <RiMenuLine aria-hidden className="size-6" />
                        )}
                    </button>
                </div>
            </nav>

            {isOpen && (
                <div
                    id="menu-mobile"
                    className="flex max-h-[calc(100dvh-4.5rem)] flex-col gap-1 overflow-y-auto border-t border-forest-moss-100 bg-white px-4 pb-5 pt-3 sm:px-8 xl:hidden"
                >
                    {navlink.map((menu) => {
                        const active = isActiveLink(menu.links, pathname, hash);

                        return (
                            <HashLink
                                key={menu.id}
                                to={menu.links}
                                smooth
                                onClick={closeMenu}
                                aria-current={active ? 'page' : undefined}
                                className={`block rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                                    active
                                        ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
                                        : 'font-medium text-oxford-navy-900/80 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
                                }`}
                            >
                                {menu.label}
                            </HashLink>
                        );
                    })}

                    <div className="mt-2 flex flex-row flex-wrap items-center gap-2 border-t border-forest-moss-100 pt-4">
                        {isAuthenticated ? (
                            <>
                                <Link
                                    to="/dashboard"
                                    onClick={closeMenu}
                                    className="min-w-0 flex-1 truncate text-sm font-semibold text-oxford-navy-700 hover:underline"
                                >
                                    Halo, {user?.name}
                                </Link>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        closeMenu();
                                        void logout();
                                    }}
                                >
                                    Logout
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" onClick={closeMenu}>
                                    <Button variant="outline2">Login</Button>
                                </Link>
                                <Link to="/register" onClick={closeMenu}>
                                    <Button variant="secondary">
                                        Register
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
