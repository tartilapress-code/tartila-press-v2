import { NavLink } from 'react-router-dom';
import { NavLabel } from '@/components/notification/UnreadBadge';
import { linkClass } from './navLinkClass';

/** Tautan Panel Penulis: naskah, buku terbit, royalti, paket custom. */
export default function WriterNavLinks() {
    return (
        <>
            <NavLink to="/dashboard/naskah" className={linkClass}>
                <NavLabel categories={['manuscript', 'isbn']}>
                    Naskah Saya
                </NavLabel>
            </NavLink>
            <NavLink to="/dashboard/buku-terbit" className={linkClass}>
                <NavLabel categories={['book']}>Buku Terbit</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/royalti" className={linkClass}>
                <NavLabel categories={['mou']}>Royalti Saya</NavLabel>
            </NavLink>
            <NavLink to="/dashboard/paket-custom" className={linkClass}>
                Paket Custom
            </NavLink>
        </>
    );
}
