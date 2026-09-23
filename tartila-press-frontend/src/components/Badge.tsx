import type { ReactNode } from 'react';

const variants = {
    primary:
        'px-1.5 py-1 font-semibold text-sm text-white bg-red-600 w-fit rounded-sm',
    secondary:
        'px-1.5 py-1 font-medium text-sm text-black  bg-white w-fit rounded-sm',
};

export interface BadgeProps {
    variant?: 'primary' | 'secondary';
    children: React.ReactNode;
}

export default function Badge({
    variant = 'primary',
    children,
}: BadgeProps): ReactNode {
    return (
        <>
            <span className={` ${variants[variant]}`}>{children}</span>
        </>
    );
}
