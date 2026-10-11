import type React from 'react';
import type { ReactNode } from 'react';

// Tema terang: `primary` navy, `secondary` hijau padat (mis. Logout, Register),
// `outline`/`outline2` berbingkai untuk aksi kedua, `white` putih berbingkai.
const variants = {
    primary: 'bg-oxford-navy-700 text-white hover:bg-oxford-navy-600',
    secondary: 'bg-forest-moss-600 text-white hover:bg-forest-moss-700',
    outline:
        'text-oxford-navy-700 border border-oxford-navy-700 hover:bg-forest-moss-50',
    outline2:
        'text-oxford-navy-700 border border-oxford-navy-200 hover:bg-forest-moss-50 hover:border-oxford-navy-300',
    white: 'bg-white text-oxford-navy-700 ring-1 ring-oxford-navy-200 hover:bg-forest-moss-50',
};

type ButtonProps = {
    variant?: 'primary' | 'secondary' | 'outline' | 'outline2' | 'white';
    className?: string;
    children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
    variant = 'primary',
    className = '',
    children,
    ...ButtonProps
}: ButtonProps): ReactNode {
    return (
        <>
            <button
                className={`
                    hover:cursor-pointer transition-colors duration-200
                    disabled:cursor-not-allowed disabled:opacity-60 ${className}
                    font-semibold text-sm rounded-lg px-4 py-3 h-fit ${variants[variant]}`}
                {...ButtonProps}
            >
                {children}
            </button>
        </>
    );
}
