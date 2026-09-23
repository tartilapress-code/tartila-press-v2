import type { ReactNode } from 'react';

export interface TitleProps {
    children: React.ReactNode;
}

export default function Title({ children }: TitleProps): ReactNode {
    return (
        <>
            <h3 className="text-3xl font-semibold text-oxford-navy-900 mb-15 align-middle text-center">
                {children}
            </h3>
        </>
    );
}
