import { NavLink } from 'react-router-dom';
import { NavLabel } from '@/components/notification/UnreadBadge';
import { linkClass } from './navLinkClass';

/** Tautan grup "Profil": Data Akun, Data Pribadi, Profil Publik. */
export default function AccountNavLinks({
    isPenulisOrEditor,
}: {
    isPenulisOrEditor: boolean;
}) {
    return (
        <>
            <NavLink to="/dashboard/akun" className={linkClass}>
                <NavLabel categories={['role']}>Data Akun</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/data-pribadi" className={linkClass}>
                Data Pribadi
            </NavLink>
            {isPenulisOrEditor && (
                <NavLink to="/dashboard/profil-publik" className={linkClass}>
                    Profil Publik
                </NavLink>
            )}
        </>
    );
}
