import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import DashboardShell from './DashboardShell';
import { linkClass } from './navLinkClass';
import UserDashboardNavLinks from './UserDashboardNavLinks';

export default function UserLayout() {
    const { user } = useAuth();

    const isPenulisOrEditor = hasAnyRole(user, ['penulis', 'editor']);
    const isEditor = hasAnyRole(user, ['editor']);
    const isAdmin = hasAnyRole(user, ['admin']);

    return (
        <DashboardShell backTo="/" backLabel="Kembali ke Beranda">
            <UserDashboardNavLinks
                isPenulisOrEditor={isPenulisOrEditor}
                isEditor={isEditor}
            />
            {isAdmin && (
                <NavLink to="/admin" className={linkClass}>
                    Panel Admin
                </NavLink>
            )}
        </DashboardShell>
    );
}
