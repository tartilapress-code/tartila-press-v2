import type { ReactNode } from 'react';
import { HeroHill, HeroLeafRight, Sprig } from '@/components/art/HeroArt';

/**
 * Bingkai halaman akun (login, daftar, lupa/reset password): kartu putih di
 * tengah latar terang berhiaskan daun. `size="lg"` untuk formulir yang lebih
 * panjang (daftar).
 */
export default function AuthCard({
    children,
    size = 'md',
}: {
    children: ReactNode;
    size?: 'md' | 'lg';
}) {
    return (
        // Keluar dari margin <main> supaya latar selebar halaman.
        <div className="relative isolate -mx-10 -my-2 overflow-hidden bg-white">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[22%] sm:block" />
            <Sprig className="pointer-events-none absolute -bottom-1 left-[6%] hidden h-[110px] w-auto lg:block" />

            <div className="mx-auto flex min-h-[72vh] max-w-[1232px] items-center justify-center px-4 py-10 sm:px-8">
                <div
                    className={`flex w-full flex-col gap-5 rounded-2xl border border-forest-moss-100 bg-white p-6 shadow-[0_6px_24px_-10px_rgba(1,26,44,0.22)] sm:p-8 ${
                        size === 'lg' ? 'max-w-xl' : 'max-w-md'
                    }`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
