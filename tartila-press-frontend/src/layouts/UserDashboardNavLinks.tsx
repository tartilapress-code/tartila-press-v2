import { NavLink } from 'react-router-dom';
import { NavGroup } from './DashboardNav';
import { linkClass } from './navLinkClass';
import { NavLabel } from '@/components/notification/UnreadBadge';
import AccountNavLinks from './AccountNavLinks';
import EditorNavLinks from './EditorNavLinks';
import WriterNavLinks from './WriterNavLinks';

/** Ringkasan + Notifikasi: tautan teratas menu dashboard. */
export function DashboardOverviewLinks() {
    return (
        <>
            <NavLink to="/dashboard" end className={linkClass}>
                Ringkasan
            </NavLink>
            <NavLink to="/dashboard/notifikasi" className={linkClass}>
                <NavLabel categories={[]} total>
                    Notifikasi
                </NavLabel>
            </NavLink>
        </>
    );
}

/**
 * Menu dashboard pengguna: Panel Penulis, Profil, lalu pesanan, dompet,
 * artikel, event, sertifikat (dan grup Editor). Menu yang difokuskan ke satu
 * panel (admin / editor / penulis) menampilkan sebagian grup di tempat lain.
 */
export default function UserDashboardNavLinks({
    isPenulisOrEditor,
    isEditor,
    showOverview = true,
    showProfile = true,
    showWriterPanel = true,
}: {
    isPenulisOrEditor: boolean;
    isEditor: boolean;
    // false: sudah ditampilkan di tempat lain (menu yang difokuskan).
    showOverview?: boolean;
    showProfile?: boolean;
    showWriterPanel?: boolean;
}) {
    return (
        <>
            {showOverview && <DashboardOverviewLinks />}

            {showWriterPanel && (
                <NavGroup label="Panel Penulis">
                    <WriterNavLinks />
                </NavGroup>
            )}

            {showProfile && (
                <NavGroup label="Profil">
                    <AccountNavLinks isPenulisOrEditor={isPenulisOrEditor} />
                </NavGroup>
            )}

            <NavLink to="/dashboard/pesanan" className={linkClass}>
                <NavLabel categories={['order']}>Pesanan Saya</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/keranjang" className={linkClass}>
                Keranjang Buku
            </NavLink>
            {isPenulisOrEditor && (
                <NavLink to="/dashboard/dompet" className={linkClass}>
                    <NavLabel categories={['wallet']}>Dompet Saya</NavLabel>
                </NavLink>
            )}
            {isPenulisOrEditor && (
                <NavLink to="/dashboard/voucher-saya" className={linkClass}>
                    <NavLabel categories={['voucher']}>Voucher Saya</NavLabel>
                </NavLink>
            )}

            <NavGroup label="Artikel">
                <NavLink to="/dashboard/tulis-artikel" className={linkClass}>
                    Tulis Artikel
                </NavLink>
                <NavLink to="/dashboard/artikel-saya" className={linkClass}>
                    <NavLabel categories={['article']}>Artikel Saya</NavLabel>
                </NavLink>
            </NavGroup>

            <NavLink to="/dashboard/event-saya" className={linkClass}>
                <NavLabel categories={['event']}>Event Saya</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/sertifikat-saya" className={linkClass}>
                <NavLabel categories={['certificate']}>
                    Sertifikat Saya
                </NavLabel>
            </NavLink>

            {isEditor && (
                <NavGroup label="Panel Editor">
                    <EditorNavLinks />
                </NavGroup>
            )}
        </>
    );
}
