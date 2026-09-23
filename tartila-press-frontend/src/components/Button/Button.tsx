import type React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
    primary: 'bg-oxford-navy-700 text-white hover:bg-oxford-navy-600',
    secondary: 'bg-forest-moss-500 text-white hover:bg-forest-moss-400',
    outline:
        'text-oxford-navy-700 border border-oxford-navy-700  hover:text-oxford-navy-700 hover:text-black hover:bg-gray-200 ',
    outline2:
        'text-forest-moss-100 border border-forest-moss-100  hover:text-oxford-navy-700 hover:text-black hover:bg-gray-200 ',
    white: 'bg-white text-oxford-navy-900  hover:bg-oxford-navy-800 hover:text-white ',
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
                    hover:cursor-pointer hover:duration-400 ${className}
                    font-semibold text-sm rounded-lg px-4 py-3 h-fit ${variants[variant]}`}
                {...ButtonProps}
            >
                {children}
            </button>
        </>
    );
}
