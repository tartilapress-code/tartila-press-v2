import type { ReactNode } from 'react';

export interface WrapperProps {
    id?: string;
    // `tint` memberi latar hijau sangat muda supaya seksi berselang-seling.
    tone?: 'white' | 'tint';
    children: React.ReactNode;
}

/**
 * Satu seksi halaman beranda selebar halaman (keluar dari margin <main>),
 * isinya dibatasi lebar 1232px dan diberi jarak atas-bawah.
 */
export default function Wrapper({
    id,
    tone = 'white',
    children,
}: WrapperProps): ReactNode {
    return (
        <section
            id={id}
            className={`-mx-10 scroll-mt-20 ${
                tone === 'tint' ? 'bg-forest-moss-50/60' : 'bg-white'
            }`}
        >
            <div className="mx-auto flex max-w-[1232px] flex-col gap-8 px-6 py-14 sm:px-10 sm:py-16">
                {children}
            </div>
        </section>
    );
}
