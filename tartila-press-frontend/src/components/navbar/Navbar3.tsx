import { useState } from 'react';

interface NavItem {
    name: string;
    href: string;
}

const navItems: NavItem[] = [
    {
        name: 'Home',
        href: '/',
    },
    {
        name: 'Books',
        href: '/books',
    },
    {
        name: 'Events',
        href: '/events',
    },
    {
        name: 'About',
        href: '/about',
    },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    return (
        <nav className="w-full border-b bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
                {/* Logo */}
                <a href="/" className="text-2xl font-bold text-blue-900">
                    Literasia
                </a>

                {/* Desktop Navigation */}
                <div className="hidden items-center gap-8 md:flex">
                    {navItems.map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="font-medium text-gray-700 transition hover:text-blue-700"
                        >
                            {item.name}
                        </a>
                    ))}
                </div>

                {/* Desktop Button */}
                <div className="hidden md:block">
                    <a
                        href="/login"
                        className="rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white transition hover:bg-blue-800"
                    >
                        Login
                    </a>
                </div>

                {/* Mobile Menu Button */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
                    aria-label="Toggle navigation menu"
                    aria-expanded={isOpen}
                >
                    {isOpen ? (
                        // X icon
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    ) : (
                        // Hamburger icon
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile Navigation */}
            {isOpen && (
                <div className="border-t bg-white px-4 py-4 md:hidden">
                    <div className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <a
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-700"
                            >
                                {item.name}
                            </a>
                        ))}

                        <a
                            href="/login"
                            onClick={() => setIsOpen(false)}
                            className="mt-2 rounded-lg bg-blue-700 px-4 py-3 text-center font-medium text-white hover:bg-blue-800"
                        >
                            Login
                        </a>
                    </div>
                </div>
            )}
        </nav>
    );
}
