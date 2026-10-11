import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import AccountNavLinks from './AccountNavLinks';
import { NavGroup } from './DashboardNav';
import FoldedNavGroup from './FoldedNavGroup';
import { DashboardOverviewLinks } from './UserDashboardNavLinks';
import { PROFILE_CATEGORIES, isProfilePage } from './navSections';

export type NavPanel = {
    label: string;
    content: ReactNode;
    isPage: (pathname: string) => boolean;
    // Kategori notifikasi milik panel (dihitung di panel ini saja).
    isCategory: (category: string) => boolean;
};

/**
 * Menu samping yang difokuskan ke peran tertinggi. Urutan: Ringkasan &
 * Notifikasi, panel utama (terbuka), panel peran lain (Editor, Penulis —
 * terlipat), Profil, lalu Menu Lainnya. Grup terlipat terbuka sendiri saat
 * salah satu halamannya sedang dibuka.
 */
export default function FocusedDashboardNav({
    panel,
    extraPanels = [],
    isNeutralPage = () => false,
    otherLinks,
}: {
    panel: NavPanel;
    // Panel peran lain, dalam urutan admin → editor → penulis.
    extraPanels?: NavPanel[];
    // Halaman bersama yang tidak membuka grup lain (mis. detail naskah).
    isNeutralPage?: (pathname: string) => boolean;
    otherLinks: ReactNode;
}) {
    const { user } = useAuth();
    const { pathname } = useLocation();

    const panels = [panel, ...extraPanels];
    const onProfile = isProfilePage(pathname);
    const onAnyPanel = panels.some((item) => item.isPage(pathname));
    const onOther =
        pathname.startsWith('/dashboard/') &&
        !pathname.startsWith('/dashboard/notifikasi') &&
        !onProfile &&
        !onAnyPanel &&
        !isNeutralPage(pathname);

    return (
        <>
            <DashboardOverviewLinks />

            <NavGroup label={panel.label}>{panel.content}</NavGroup>

            {extraPanels.map((extra) => (
                <FoldedNavGroup
                    key={extra.label}
                    label={extra.label}
                    isActive={
                        extra.isPage(pathname) && !isNeutralPage(pathname)
                    }
                    countsCategory={extra.isCategory}
                >
                    {extra.content}
                </FoldedNavGroup>
            ))}

            <FoldedNavGroup
                label="Profil"
                isActive={onProfile}
                countsCategory={(category) =>
                    PROFILE_CATEGORIES.includes(category)
                }
            >
                <AccountNavLinks
                    isPenulisOrEditor={hasAnyRole(user, ['penulis', 'editor'])}
                />
            </FoldedNavGroup>

            <FoldedNavGroup
                label="Menu Lainnya"
                isActive={onOther}
                countsCategory={(category) =>
                    !panels.some((item) => item.isCategory(category)) &&
                    !PROFILE_CATEGORIES.includes(category) &&
                    !category.startsWith('admin_')
                }
            >
                {otherLinks}
            </FoldedNavGroup>
        </>
    );
}
