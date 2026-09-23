import navbarLink from '@/data/navlink.json';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const navLinkStatus = {
    active: 'text-white',
    not_active: 'text-white text-[16px] hover:duration-400',
};

function NavbarLink() {
    const [isActive, setIsActive] = useState<boolean>(false);

    return (
        <>
            <ul>
                {navbarLink.map((link) => (
                    <li
                        key={link.id}
                        className={`${isActive ? navLinkStatus.active : navLinkStatus.not_active}`}
                    >
                        <NavLink to={link.label}>{link.label}</NavLink>
                    </li>
                ))}
            </ul>
        </>
    );
}

export default NavbarLink;
