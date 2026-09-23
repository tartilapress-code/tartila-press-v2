import Logo from '../Logo';
import navlink from '../../data/navlink.json';
import { NavHashLink } from 'react-router-hash-link';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { RiCloseLargeFill, RiMenuLine } from '@remixicon/react';
import Button from '../Button/Button';
import { useAuth } from '@/context/useAuth';

export default function Navbar2(): React.ReactNode {
    const status = {
        active: 'text-white',
        notActive: 'text-white text-[16px] hover:duration-400',
    };

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { user, isAuthenticated, logout } = useAuth();

    return (
        <>
            <nav className="relative">
                <div
                    className={`
                            xl:rounded-full
                            flex flex-row justify-between rounded-full
                            items-center bg-oxford-navy-400/40 backdrop-blur-lg px-15 py-2 sticky z-200 w-full
                            hover:shadow-xl/50 hover:shadow-oxford-navy-900 hover:duration-150 tansition-all
                            `}
                >
                    <Logo size="small" />
                    <ul>
                        {/*Desktop Navigation*/}
                        <div
                            className="
                                xl:flex  gap-4
                                hidden
                                "
                        >
                            {navlink.map((menu) => (
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
                    </ul>

                    {/*desktop login button*/}
                    <div className="block duration-400 lg:flex lg:flex-row lg:gap-2 lg:items-center">
                        {isAuthenticated ? (
                            <div className="hidden xl:flex xl:flex-row xl:items-center xl:gap-3">
                                <NavLink
                                    to="/dashboard"
                                    className="text-white text-sm hover:text-forest-moss-300"
                                >
                                    Halo, {user?.name}
                                </NavLink>
                                <Button
                                    variant="outline2"
                                    onClick={() => logout()}
                                >
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <>
                                <NavLink to="login">
                                    <Button
                                        variant="primary"
                                        className="hidden xl:flex"
                                    >
                                        Login
                                    </Button>
                                </NavLink>

                                <NavLink to="/register">
                                    <Button
                                        variant="secondary"
                                        className="hidden xl:flex"
                                    >
                                        Register
                                    </Button>
                                </NavLink>
                            </>
                        )}
                        <div onClick={() => setIsOpen(!isOpen)}>
                            {isOpen ? (
                                <RiCloseLargeFill className="text-white xl:hidden duration-700" />
                            ) : (
                                <RiMenuLine className="text-white  xl:hidden duration-700" />
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className={`
                        absolute right-0 mt-2 xl:hidden
                        transition-all duration-300 ease-out
                        hover:shadow-xl/50 hover:shadow-oxford-navy-900 hover:duration-150
                        ${
                            isOpen
                                ? 'translate-y-0 scale-100 opacity-100'
                                : '-translate-y-2 scale-95 opacity-0 pointer-events-none'
                        }
                    `}
                >
                    <div
                        className="
                            w-fit rounded-xl p-6
                            bg-oxford-navy-400/40
                            backdrop-blur-lg
                        "
                    >
                        <ul>
                            {navlink.map((menu) => (
                                <li key={menu.id}>
                                    <NavHashLink
                                        to={menu.links}
                                        smooth
                                        className={({ isActive }) =>
                                            `block p-2 transition-colors
                                            hover:text-forest-moss-400
                                            ${
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
                        </ul>
                        <div className="flex flex-row gap-2 border-t-2 border-t-oxford-navy-500 pt-4">
                            {isAuthenticated ? (
                                <div className="flex flex-row items-center gap-3">
                                    <NavLink
                                        to="/dashboard"
                                        className="text-white text-sm hover:text-forest-moss-300"
                                    >
                                        Halo, {user?.name}
                                    </NavLink>
                                    <Button
                                        variant="outline2"
                                        className="block xl:hidden"
                                        onClick={() => logout()}
                                    >
                                        Logout
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <NavLink to="login">
                                        <Button
                                            variant="primary"
                                            className="block xl:hidden"
                                        >
                                            Login
                                        </Button>
                                    </NavLink>

                                    <NavLink to="register">
                                        <Button
                                            variant="secondary"
                                            className="block xl:hidden"
                                        >
                                            Register
                                        </Button>
                                    </NavLink>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
        </>
    );
}
