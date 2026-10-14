import { NavLink } from 'react-router-dom';
import { NavLabel } from '@/components/notification/UnreadBadge';
import { DashboardOverviewLinks } from './UserDashboardNavLinks';
import { linkClass } from './navLinkClass';

const BOOK_URL =
    (import.meta.env.VITE_BOOK_URL as string | undefined) ??
    'http://localhost:5174';

/**
 * Menu dashboard akun mitra: di Tartila Press mitra hanya pengguna biasa yang
 * bisa membeli buku fisik. Ebook-nya dikelola di Tartila Book.
 */
export default function PartnerDashboardNav() {
    return (
        <>
            <DashboardOverviewLinks />
            <NavLink to="/dashboard/pesanan" className={linkClass}>
                <NavLabel categories={['order']}>Pesanan Saya</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/keranjang" className={linkClass}>
                Keranjang Buku
            </NavLink>
            <NavLink to="/dashboard/dompet" className={linkClass}>
                <NavLabel categories={['wallet']}>Dompet Saya</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/akun" className={linkClass}>
                Data Akun
            </NavLink>
            <a
                href={`${BOOK_URL}/mitra`}
                className={linkClass({ isActive: false })}
            >
                Dashboard Mitra (Tartila Book) ↗
            </a>
        </>
    );
}
