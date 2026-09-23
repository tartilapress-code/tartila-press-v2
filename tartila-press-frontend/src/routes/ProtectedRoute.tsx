import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';

export default function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();

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

    return <Outlet />;
}
