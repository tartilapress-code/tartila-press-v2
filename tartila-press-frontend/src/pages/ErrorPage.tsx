import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { HeroHill, HeroLeafRight } from '@/components/art/HeroArt';

/**
 * Halaman galat: dipakai router untuk kesalahan tak terduga dan langsung oleh
 * halaman detail saat datanya tidak ada (404).
 */
export default function ErrorPage() {
    const error = useRouteError();
    const notFound =
        !error || (isRouteErrorResponse(error) && error.status === 404);

    return (
        <div className="relative isolate flex min-h-[72vh] items-center justify-center overflow-hidden bg-white px-6 py-16 text-center">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[22%] sm:block" />

            <div className="flex max-w-md flex-col items-center gap-4">
                <span className="font-display text-7xl font-bold leading-none text-forest-moss-600">
                    {notFound ? '404' : 'Oops'}
                </span>
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                    {notFound ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan'}
                </h1>
                <p className="text-[15px] leading-relaxed text-oxford-navy-900/65">
                    {notFound
                        ? 'Alamat yang Anda buka tidak ada atau sudah dipindahkan.'
                        : 'Halaman ini gagal ditampilkan. Muat ulang halaman atau kembali ke beranda.'}
                </p>
                <Link
                    to="/"
                    className="mt-2 inline-flex items-center justify-center rounded-lg bg-oxford-navy-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                >
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
