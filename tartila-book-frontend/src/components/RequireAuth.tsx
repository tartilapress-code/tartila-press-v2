import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';

/** Halaman yang butuh login (atau admin bila `admin`); selain itu diarahkan ke halaman masuk. */
export default function RequireAuth({
    admin = false,
    partner = false,
}: {
    admin?: boolean;
    partner?: boolean;
}) {
    const { user, isLoading, isAdmin, isPartner } = useAuth();
    const { pathname, search } = useLocation();

    if (isLoading) {
        return (
            <p className="px-6 py-16 text-center text-oxford-navy-900/70">
                Memuat...
            </p>
        );
    }

    if (!user) {
        return (
            <Navigate
                to={`/masuk?next=${encodeURIComponent(pathname + search)}`}
                replace
            />
        );
    }

    if (admin && !isAdmin) {
        return (
            <div className="mx-auto max-w-md px-6 py-16 text-center">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Khusus admin
                </h1>
                <p className="mt-2 text-oxford-navy-900/70">
                    Akun Anda tidak memiliki akses ke halaman ini.
                </p>
            </div>
        );
    }

    if (partner && !isPartner) {
        return (
            <div className="mx-auto max-w-md px-6 py-16 text-center">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Khusus mitra
                </h1>
                <p className="mt-2 text-oxford-navy-900/70">
                    Akun Anda belum terdaftar sebagai mitra. Hubungi admin
                    Tartila Book.
                </p>
            </div>
        );
    }

    return <Outlet />;
}
