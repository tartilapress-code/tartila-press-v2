import { NavLink } from 'react-router-dom';
import { NavLabel } from '@/components/notification/UnreadBadge';
import { linkClass } from './navLinkClass';

/** Tautan fitur editor (Panel Editor / grup "Editor"). */
export default function EditorNavLinks() {
    return (
        <>
            <NavLink to="/dashboard/profil-editor" className={linkClass}>
                Profil Editor
            </NavLink>
            <NavLink to="/dashboard/pool-naskah" className={linkClass}>
                <NavLabel categories={['pool']}>Pool Naskah</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/naskah-ditugaskan" className={linkClass}>
                <NavLabel categories={['assigned_manuscript']}>
                    Naskah Ditugaskan
                </NavLabel>
            </NavLink>
            <NavLink to="/dashboard/fee-saya" className={linkClass}>
                Fee Saya
            </NavLink>
            <NavLink to="/dashboard/proyek-bab-buku-saya" className={linkClass}>
                Proyek Book Chapter Saya
            </NavLink>
        </>
    );
}
