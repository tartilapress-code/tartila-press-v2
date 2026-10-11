import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import FocusedDashboardNav from './FocusedDashboardNav';
import { editorPanel, isManuscriptDetail, writerPanel } from './rolePanels';
import UserDashboardNavLinks from './UserDashboardNavLinks';

/**
 * Menu samping editor: Panel Editor (terbuka), Panel Penulis, Profil, Menu
 * Lainnya.
 */
export default function EditorDashboardNav() {
    const { user } = useAuth();

    return (
        <FocusedDashboardNav
            panel={editorPanel}
            extraPanels={[writerPanel]}
            isNeutralPage={isManuscriptDetail}
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
