import { useCallback, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import { useTranslation } from 'react-i18next';
import { RiCloseLargeFill, RiMenuLine } from '@remixicon/react';
import Logo from '../Logo';
import Button from '../Button/Button';
import { NAV_LINKS } from '@/data/navlink';
import { useAuth } from '@/context/useAuth';
import { useNavbarFit } from '@/hooks/useNavbarFit';
import { useLanguage } from '@/i18n/useLanguage';
import LanguageSwitcher, { LanguageChoices } from './LanguageSwitcher';
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

// Yang disembunyikan saat navbar menjadi hamburger. `useNavbarFit` mengatur
// atribut data pada <header> (grup "nav") sesuai lebar isi yang sebenarnya.
const desktopOnly = 'group-data-[collapsed=on]/nav:hidden';

/**
 * Navbar: menu penuh bila muat, dan otomatis menjadi hamburger bila tidak
 * (lebar layar, panjang label bahasa, atau nama pengguna).
 */
export default function Navbar() {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { user, isAuthenticated, logout } = useAuth();
    const { pathname, hash } = useLocation();
    const headerRef = useRef<HTMLElement>(null);

    const closeMenu = useCallback(() => setIsOpen(false), []);

    useNavbarFit(
        headerRef,
        closeMenu,
        `${language}|${isAuthenticated}|${user?.name ?? ''}`
    );

    return (
        <header
            ref={headerRef}
            data-collapsed="off"
            data-tagline="on"
            data-lang="full"
            data-user="wide"
            className="group/nav sticky top-0 z-50 border-b border-forest-moss-100 bg-white/95 backdrop-blur"
        >
            <nav
                aria-label={t('nav.main')}
                className="flex flex-row items-center justify-between gap-4 px-4 py-2 sm:px-8 xl:px-10 min-[1440px]:py-2.5"
            >
                <Logo
                    size="small"
                    className="shrink-0"
                    sloganClassName="max-sm:hidden group-data-[tagline=off]/nav:hidden"
                />

                <ul
                    className={`flex shrink-0 flex-row items-center gap-x-[var(--nav-gap,20px)] ${desktopOnly}`}
                >
                    {NAV_LINKS.map((menu) => {
                        const active = isActiveLink(menu.to, pathname, hash);

                        return (
                            <li key={menu.id}>
                                <HashLink
                                    to={menu.to}
                                    smooth
                                    aria-current={active ? 'page' : undefined}
                                    className={`${linkBase} ${
                                        active
                                            ? linkState.active
                                            : linkState.idle
                                    }`}
                                >
                                    {t(`nav.menu.${menu.key}`)}
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

                <div className="flex shrink-0 flex-row items-center gap-2 sm:gap-3">
                    <NavbarSearch />
                    <div className="max-sm:hidden">
                        <LanguageSwitcher />
                    </div>
                    <span
                        aria-hidden
                        className={`h-8 w-px bg-forest-moss-200 ${desktopOnly}`}
                    />

                    {isAuthenticated ? (
                        <div
                            className={`flex flex-row items-center gap-3 ${desktopOnly}`}
                        >
                            <UserMenu />
                            <Button
                                variant="secondary"
                                className="h-11 whitespace-nowrap"
                                onClick={() => logout()}
                            >
                                {t('nav.logout')}
                            </Button>
                        </div>
                    ) : (
                        <div
                            className={`flex flex-row items-center gap-2 ${desktopOnly}`}
                        >
                            <Link to="/login">
                                <Button
                                    variant="outline2"
                                    className="h-11 whitespace-nowrap"
                                >
                                    {t('nav.login')}
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button
                                    variant="secondary"
                                    className="h-11 whitespace-nowrap"
                                >
                                    {t('nav.register')}
                                </Button>
                            </Link>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsOpen((previous) => !previous)}
                        className="hidden size-10 items-center justify-center rounded-full text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-forest-moss-50 group-data-[collapsed=on]/nav:inline-flex"
                        aria-expanded={isOpen}
                        aria-controls="menu-mobile"
                        aria-label={
                            isOpen ? t('nav.closeMenu') : t('nav.openMenu')
                        }
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
                    className="flex max-h-[calc(100dvh-4.5rem)] flex-col gap-1 overflow-y-auto border-t border-forest-moss-100 bg-white px-4 pb-5 pt-3 sm:px-8 group-data-[collapsed=off]/nav:hidden"
                >
                    {NAV_LINKS.map((menu) => {
                        const active = isActiveLink(menu.to, pathname, hash);

                        return (
                            <HashLink
                                key={menu.id}
                                to={menu.to}
                                smooth
                                onClick={closeMenu}
                                aria-current={active ? 'page' : undefined}
                                className={`block rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                                    active
                                        ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
                                        : 'font-medium text-oxford-navy-900/80 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
                                }`}
                            >
                                {t(`nav.menu.${menu.key}`)}
                            </HashLink>
                        );
                    })}

                    <div className="mt-2 flex flex-col gap-2 border-t border-forest-moss-100 pt-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-oxford-navy-900/65">
                            {t('nav.language.label')}
                        </span>
                        <LanguageChoices />
                    </div>

                    <div className="mt-2 flex flex-row flex-wrap items-center gap-2 border-t border-forest-moss-100 pt-4">
                        {isAuthenticated ? (
                            <>
                                <Link
                                    to="/dashboard"
                                    onClick={closeMenu}
                                    className="min-w-0 flex-1 truncate text-sm font-semibold text-oxford-navy-700 hover:underline"
                                >
                                    {t('nav.hello', { name: user?.name ?? '' })}
                                </Link>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        closeMenu();
                                        void logout();
                                    }}
                                >
                                    {t('nav.logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" onClick={closeMenu}>
                                    <Button variant="outline2">
                                        {t('nav.login')}
                                    </Button>
                                </Link>
                                <Link to="/register" onClick={closeMenu}>
                                    <Button variant="secondary">
                                        {t('nav.register')}
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
