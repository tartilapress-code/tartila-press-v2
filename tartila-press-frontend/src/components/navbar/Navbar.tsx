import { NavHashLink } from 'react-router-hash-link';

import menus from '../../data/navlink.json';
import '../styles/index.css';
import Logo from '../Logo';
import Button from '../Button/Button';

export default function Navbar() {
    const status = {
        active: 'text-white border-b-2 border-b-oxford-navy-100 hover:border-b-forest-moss-500',
        notActive:
            'text-white text-[16px] hover:border-b-2 hover:border-b-forest-moss-500 hover:duration-400',
    };

    return (
        <nav className="fixed top-0 w-full bg-oxford-navy-900 px-10 py-2 z-200">
            <ul className="flex flex-row gap-20 justify-between items-center ">
                <Logo />
                <div className="flex gap-15">
                    <div className="flex flex-row gap-4 text-white">
                        {menus.map((menu) => (
                            <li key={menu.id} className="">
                                <NavHashLink
                                    to={menu.links}
                                    smooth
                                    className={({ isActive }) =>
                                        `block p-2 transition-colors hover:text-forest-moss-400  ${
                                            isActive
                                                ? status.active
                                                : status.notActive
                                        }`
                                    }
                                >
                                    {menu.label}
                                </NavHashLink>
                            </li>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="primary">Login</Button>
                        <Button variant="secondary">Sign Up</Button>
                    </div>
                </div>
            </ul>
        </nav>
    );
}
