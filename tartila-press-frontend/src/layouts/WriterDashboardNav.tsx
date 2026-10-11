import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import FocusedDashboardNav from './FocusedDashboardNav';
import { writerPanel } from './rolePanels';
import UserDashboardNavLinks from './UserDashboardNavLinks';

/** Menu samping penulis: Panel Penulis paling atas, lalu Profil, Menu Lainnya. */
export default function WriterDashboardNav() {
    const { user } = useAuth();

    return (
        <FocusedDashboardNav
            panel={writerPanel}
            otherLinks={
                <UserDashboardNavLinks
                    isPenulisOrEditor={hasAnyRole(user, ['penulis', 'editor'])}
                    isEditor={false}
                    showOverview={false}
                    showProfile={false}
                    showWriterPanel={false}
                />
            }
        />
    );
}
