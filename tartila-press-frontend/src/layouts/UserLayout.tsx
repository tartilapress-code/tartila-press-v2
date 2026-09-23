import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';

export default function UserLayout() {
    const { user, logout } = useAuth();

    const isPenulisOrEditor = hasAnyRole(user, ['penulis', 'editor']);
    const isEditor = hasAnyRole(user, ['editor']);
    const isAdmin = hasAnyRole(user, ['admin']);

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `block px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            isActive
                ? 'bg-forest-moss-500 text-white'
                : 'text-white/80 hover:bg-oxford-navy-700 hover:text-white'
        }`;

    return (
        <div className="flex flex-col gap-6 my-6">
            <div className="flex flex-row items-center justify-between bg-oxford-navy-900 rounded-xl px-4 py-3">
                <Link to="/" className="text-white text-sm hover:text-forest-moss-300">
                    ← Kembali ke Beranda
                </Link>
                <div className="flex flex-row items-center gap-3">
                    <p className="text-white text-sm">Halo, {user?.name}</p>
                    <button
                        onClick={() => logout()}
                        className="text-white/70 text-sm hover:text-white"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="md:w-64 shrink-0">
                    <nav className="flex flex-row md:flex-col gap-2 bg-oxford-navy-900 rounded-xl p-4 overflow-x-auto">
                        <NavLink to="/dashboard" end className={linkClass}>
                            Data Akun
                        </NavLink>
                        <NavLink
                            to="/dashboard/data-pribadi"
                            className={linkClass}
                        >
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
                        <NavLink
                            to="/dashboard/paket-custom"
                            className={linkClass}
                        >
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
                        {isEditor && (
                            <>
                                <NavLink
                                    to="/dashboard/profil-editor"
                                    className={linkClass}
                                >
                                    Profil Editor
                                </NavLink>
                                <NavLink
                                    to="/dashboard/pool-naskah"
                                    className={linkClass}
                                >
                                    Pool Naskah
                                </NavLink>
                                <NavLink
                                    to="/dashboard/naskah-ditugaskan"
                                    className={linkClass}
                                >
                                    Naskah Ditugaskan
                                </NavLink>
                                <NavLink
                                    to="/dashboard/proyek-bab-buku-saya"
                                    className={linkClass}
                                >
                                    Proyek Book Chapter Saya
                                </NavLink>
                            </>
                        )}
                        {isAdmin && (
                            <NavLink to="/admin" className={linkClass}>
                                Panel Admin
                            </NavLink>
                        )}
                    </nav>
                </aside>

                <div className="flex-1">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
