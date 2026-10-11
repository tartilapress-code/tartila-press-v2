import DashboardShell from './DashboardShell';
import AdminDashboardNav from './AdminDashboardNav';

export default function AdminLayout() {
    return (
        <DashboardShell backTo="/" backLabel="Kembali ke Beranda">
            <AdminDashboardNav />
        </DashboardShell>
    );
}
