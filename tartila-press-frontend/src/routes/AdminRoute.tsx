import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';

export default function AdminRoute() {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900">Memuat...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!hasAnyRole(user, ['admin'])) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
