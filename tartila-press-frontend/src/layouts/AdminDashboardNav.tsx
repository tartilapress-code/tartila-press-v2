import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { NavLabel } from '@/components/notification/UnreadBadge';
import FocusedDashboardNav, { type NavPanel } from './FocusedDashboardNav';
import { editorPanel, isManuscriptDetail, writerPanel } from './rolePanels';
import { linkClass } from './navLinkClass';
import UserDashboardNavLinks from './UserDashboardNavLinks';

const adminLinks: {
    to: string;
    label: string;
    end?: boolean;
    categories?: string[];
}[] = [
    {
        to: '/admin',
        label: 'Permintaan Role',
        end: true,
        categories: ['admin_role'],
    },
    { to: '/admin/users', label: 'Kelola User' },
    { to: '/admin/packages', label: 'Paket' },
    { to: '/admin/custom-package-items', label: 'Item Custom' },
    { to: '/admin/orders', label: 'Pesanan', categories: ['admin_order'] },
    {
        to: '/admin/manuscripts',
        label: 'Naskah',
        categories: ['admin_manuscript'],
    },
    { to: '/admin/pool-naskah', label: 'Pengaturan Pool Naskah' },
    {
        to: '/admin/terbitkan-naskah',
        label: 'Terbitkan Naskah',
        categories: ['admin_isbn'],
    },
    { to: '/admin/isbn-settings', label: 'Template Surat ISBN' },
    { to: '/admin/mou', label: 'MOU Distribusi', categories: ['admin_mou'] },
    { to: '/admin/mou-template', label: 'Template MOU' },
    { to: '/admin/sosmed', label: 'Konten Sosmed' },
    { to: '/admin/manuscript-templates', label: 'Template Naskah' },
    { to: '/admin/books', label: 'Buku', end: true },
    { to: '/admin/royalties', label: 'Royalti' },
    { to: '/admin/vouchers', label: 'Voucher dan Diskon' },
    { to: '/admin/keuangan', label: 'Keuangan' },
    { to: '/admin/hki', label: 'HKI' },
    {
        to: '/admin/withdrawals',
        label: 'Penarikan Saldo',
        categories: ['admin_withdrawal'],
    },
    {
        to: '/admin/articles',
        label: 'Artikel',
        categories: ['admin_article'],
    },
    { to: '/admin/events', label: 'Event' },
    { to: '/admin/event-categories', label: 'Kategori Event' },
    { to: '/admin/certificate-templates', label: 'Template Sertifikat' },
    { to: '/admin/book-categories', label: 'Kategori Buku' },
    { to: '/admin/field-categories', label: 'Kategori Keilmuan' },
    { to: '/admin/book-chapter-projects', label: 'Proyek Book Chapter' },
    { to: '/admin/book-chapter-settings', label: 'Pengaturan Book Chapter' },
    { to: '/admin/payment-methods', label: 'Metode Pembayaran' },
    { to: '/admin/tentang-kami', label: 'Tentang Kami' },
];

/**
 * Menu samping admin (di panel admin maupun halaman dashboard): Panel Admin
 * (terbuka), Panel Editor (bila editor), Panel Penulis, Profil, Menu Lainnya.
 */
export default function AdminDashboardNav() {
    const { user } = useAuth();
    const isEditor = hasAnyRole(user, ['editor']);

    const adminPanel: NavPanel = {
        label: 'Panel Admin',
        content: adminLinks.map((link) => (
            <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={linkClass}
            >
                <NavLabel categories={link.categories ?? []}>
                    {link.label}
                </NavLabel>
            </NavLink>
        )),
        isPage: (pathname) => pathname.startsWith('/admin'),
        isCategory: (category) => category.startsWith('admin_'),
    };

    return (
        <FocusedDashboardNav
            panel={adminPanel}
            extraPanels={isEditor ? [editorPanel, writerPanel] : [writerPanel]}
            isNeutralPage={isManuscriptDetail}
            otherLinks={
                <UserDashboardNavLinks
                    isPenulisOrEditor={hasAnyRole(user, ['penulis', 'editor'])}
                    isEditor={false}
                    showOverview={false}
                    showProfile={false}
                    showWriterPanel={false}
                />
            }
        />
    );
}
