import { NavLink } from 'react-router-dom';
import { NavGroup } from './DashboardNav';
import { linkClass } from './navLinkClass';

export default function UserDashboardNavLinks({
    isPenulisOrEditor,
    isEditor,
}: {
    isPenulisOrEditor: boolean;
    isEditor: boolean;
}) {
    return (
        <>
            <NavGroup label="Profil">
                <NavLink to="/dashboard" end className={linkClass}>
                    Data Akun
                </NavLink>
                <NavLink to="/dashboard/data-pribadi" className={linkClass}>
                    Data Pribadi
                </NavLink>
                {isPenulisOrEditor && (
                    <NavLink
                        to="/dashboard/profil-publik"
                        className={linkClass}
                    >
                        Profil Publik
                    </NavLink>
                )}
            </NavGroup>

            <NavLink to="/dashboard/paket-custom" className={linkClass}>
                Paket Custom
            </NavLink>
            <NavLink to="/dashboard/pesanan" className={linkClass}>
                Pesanan Saya
            </NavLink>
            <NavLink to="/dashboard/keranjang" className={linkClass}>
                Keranjang Buku
            </NavLink>
            <NavLink to="/dashboard/naskah" className={linkClass}>
                Naskah Saya
            </NavLink>
            <NavLink to="/dashboard/royalti" className={linkClass}>
                Royalti Saya
            </NavLink>

            <NavGroup label="Artikel">
                <NavLink to="/dashboard/tulis-artikel" className={linkClass}>
                    Tulis Artikel
                </NavLink>
                <NavLink to="/dashboard/artikel-saya" className={linkClass}>
                    Artikel Saya
                </NavLink>
            </NavGroup>

            <NavLink to="/dashboard/event-saya" className={linkClass}>
                Event Saya
            </NavLink>

            {isEditor && (
                <NavGroup label="Editor">
                    <NavLink to="/dashboard/profil-editor" className={linkClass}>
                        Profil Editor
                    </NavLink>
                    <NavLink to="/dashboard/pool-naskah" className={linkClass}>
                        Pool Naskah
                    </NavLink>
                    <NavLink
                        to="/dashboard/naskah-ditugaskan"
                        className={linkClass}
                    >
                        Naskah Ditugaskan
                    </NavLink>
                    <NavLink to="/dashboard/fee-saya" className={linkClass}>
                        Fee Saya
                    </NavLink>
                    <NavLink
                        to="/dashboard/proyek-bab-buku-saya"
                        className={linkClass}
                    >
                        Proyek Book Chapter Saya
                    </NavLink>
                </NavGroup>
            )}
        </>
    );
}
