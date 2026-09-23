import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';

export default function AdminLayout() {
    const { user, logout } = useAuth();

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `block px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            isActive
                ? 'bg-forest-moss-500 text-white'
                : 'text-white/80 hover:bg-oxford-navy-700 hover:text-white'
        }`;

    return (
        <div className="flex flex-col gap-6 my-6">
            <div className="flex flex-row items-center justify-between bg-oxford-navy-900 rounded-xl px-4 py-3">
                <Link
                    to="/dashboard"
                    className="text-white text-sm hover:text-forest-moss-300"
                >
                    ← Kembali ke Dashboard
                </Link>
                <div className="flex flex-row items-center gap-3">
                    <p className="text-white text-sm">
                        Panel Admin — {user?.name}
                    </p>
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
                        <NavLink to="/admin" end className={linkClass}>
                            Permintaan Role
                        </NavLink>
                        <NavLink to="/admin/users" className={linkClass}>
                            Kelola User
                        </NavLink>
                        <NavLink to="/admin/packages" className={linkClass}>
                            Paket
                        </NavLink>
                        <NavLink
                            to="/admin/custom-package-items"
                            className={linkClass}
                        >
                            Item Custom
                        </NavLink>
                        <NavLink to="/admin/orders" className={linkClass}>
                            Pesanan
                        </NavLink>
                        <NavLink to="/admin/manuscripts" className={linkClass}>
                            Naskah
                        </NavLink>
                        <NavLink to="/admin/books" end className={linkClass}>
                            Buku
                        </NavLink>
                        <NavLink to="/admin/royalties" className={linkClass}>
                            Royalti
                        </NavLink>
                        <NavLink
                            to="/admin/book-categories"
                            className={linkClass}
                        >
                            Kategori Buku
                        </NavLink>
                        <NavLink
                            to="/admin/field-categories"
                            className={linkClass}
                        >
                            Kategori Keilmuan
                        </NavLink>
                        <NavLink
                            to="/admin/book-chapter-projects"
                            className={linkClass}
                        >
                            Proyek Book Chapter
                        </NavLink>
                        <NavLink
                            to="/admin/book-chapter-settings"
                            className={linkClass}
                        >
                            Pengaturan Book Chapter
                        </NavLink>
                        <NavLink
                            to="/admin/payment-methods"
                            className={linkClass}
                        >
                            Metode Pembayaran
                        </NavLink>
                    </nav>
                </aside>

                <div className="flex-1">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
