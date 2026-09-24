import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import DashboardShell from './DashboardShell';
import { NavGroup } from './DashboardNav';
import { linkClass } from './navLinkClass';
import UserDashboardNavLinks from './UserDashboardNavLinks';

const adminLinks: { to: string; label: string; end?: boolean }[] = [
    { to: '/admin', label: 'Permintaan Role', end: true },
    { to: '/admin/users', label: 'Kelola User' },
    { to: '/admin/packages', label: 'Paket' },
    { to: '/admin/custom-package-items', label: 'Item Custom' },
    { to: '/admin/orders', label: 'Pesanan' },
    { to: '/admin/manuscripts', label: 'Naskah' },
    { to: '/admin/books', label: 'Buku', end: true },
    { to: '/admin/royalties', label: 'Royalti' },
    { to: '/admin/articles', label: 'Artikel' },
    { to: '/admin/events', label: 'Event' },
    { to: '/admin/event-categories', label: 'Kategori Event' },
    { to: '/admin/book-categories', label: 'Kategori Buku' },
    { to: '/admin/field-categories', label: 'Kategori Keilmuan' },
    { to: '/admin/book-chapter-projects', label: 'Proyek Book Chapter' },
    { to: '/admin/book-chapter-settings', label: 'Pengaturan Book Chapter' },
    { to: '/admin/payment-methods', label: 'Metode Pembayaran' },
];

export default function AdminLayout() {
    const { user } = useAuth();

    const isPenulisOrEditor = hasAnyRole(user, ['penulis', 'editor']);
    const isEditor = hasAnyRole(user, ['editor']);

    return (
        <DashboardShell backTo="/dashboard" backLabel="Kembali ke Dashboard">
            <NavGroup label="Panel User">
                <UserDashboardNavLinks
                    isPenulisOrEditor={isPenulisOrEditor}
                    isEditor={isEditor}
                />
            </NavGroup>

            <NavGroup label="Panel Admin">
                {adminLinks.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={linkClass}
                    >
                        {link.label}
                    </NavLink>
                ))}
            </NavGroup>
        </DashboardShell>
    );
}
