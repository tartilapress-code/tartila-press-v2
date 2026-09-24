import { useEffect, useRef, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { RiArrowLeftLine } from '@remixicon/react';

/**
 * Kerangka halaman dashboard (user dan admin) bertema terang: tautan kembali,
 * menu samping berupa kartu putih (bisa digeser mendatar di layar sempit), dan
 * kolom isi tempat halaman ditampilkan. Latar hijau sangat muda supaya kartu
 * putih di dalamnya terpisah jelas.
 */
export default function DashboardShell({
    backTo,
    backLabel,
    children,
}: {
    backTo: string;
    backLabel: string;
    // Isi menu samping.
    children: ReactNode;
}) {
    const navRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();

    // Menu yang bisa digeser: pastikan tautan halaman aktif ikut terlihat.
    useEffect(() => {
        navRef.current
            ?.querySelector('[aria-current="page"]')
            ?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [pathname]);

    return (
        // Keluar dari margin <main> supaya latar selebar halaman.
        <div className="-mx-10 -my-2 min-h-[70vh] bg-forest-moss-50/50">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
                <Link
                    to={backTo}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-moss-700 hover:underline"
                >
                    <RiArrowLeftLine aria-hidden className="size-4" />
                    {backLabel}
                </Link>

                <div className="mt-4 flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
                    <aside className="lg:sticky lg:top-24">
                        <nav
                            ref={navRef}
                            aria-label="Menu dashboard"
                            className="flex flex-row items-center gap-2 overflow-x-auto rounded-2xl border border-forest-moss-100 bg-white p-2 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] [scrollbar-width:none] lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:items-stretch lg:gap-1.5 lg:overflow-y-auto lg:p-3 [&::-webkit-scrollbar]:hidden"
                        >
                            {children}
                        </nav>
                    </aside>

                    <div className="min-w-0">
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
}
