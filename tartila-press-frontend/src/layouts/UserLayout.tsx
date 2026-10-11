import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import DashboardShell from './DashboardShell';
import UserDashboardNavLinks from './UserDashboardNavLinks';
import AdminDashboardNav from './AdminDashboardNav';
import EditorDashboardNav from './EditorDashboardNav';
import WriterDashboardNav from './WriterDashboardNav';

export default function UserLayout() {
    const { user } = useAuth();

    const isPenulisOrEditor = hasAnyRole(user, ['penulis', 'editor']);
    const isEditor = hasAnyRole(user, ['editor']);
    const isAdmin = hasAnyRole(user, ['admin']);

    // Admin / editor / penulis: menu fokus ke panelnya; Profil dan menu lain
    // dilipat. Prioritas: admin, editor, lalu penulis.
    return (
        <DashboardShell backTo="/" backLabel="Kembali ke Beranda">
            {isAdmin ? (
                <AdminDashboardNav />
            ) : isEditor ? (
                <EditorDashboardNav />
            ) : hasAnyRole(user, ['penulis']) ? (
                <WriterDashboardNav />
            ) : (
                <UserDashboardNavLinks
                    isPenulisOrEditor={isPenulisOrEditor}
                    isEditor={isEditor}
                />
            )}
        </DashboardShell>
    );
}
