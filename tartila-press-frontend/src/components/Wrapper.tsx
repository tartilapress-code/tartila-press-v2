import type { ReactNode } from 'react';

export interface WrapperProps {
    id?: string;
    children: React.ReactNode;
}

export default function Wrapper({ id, children }: WrapperProps): ReactNode {
    return (
        <>
            <div
                id={id}
                className="flex flex-col justify-center my-20 scroll-mt-30"
            >
                {children}
            </div>
        </>
    );
}
