import { Link } from 'react-router-dom';
import Button from '@/components/Button';
import { openExternal, SHOW_WEB_LINK, WEB_URL } from '@/lib/platform';

/**
 * Layar pengganti di aplikasi Android untuk halaman yang hanya ada di situs web
 * (pembelian, langganan, pesanan, panel admin). Aplikasi hanya untuk masuk dan membaca.
 */
export default function WebOnlyPage({ path = '' }: { path?: string }) {
    return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-20 text-center">
            <i
                aria-hidden
                className="ri-global-line text-5xl text-oxford-navy-700"
            />
            <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                Dikelola lewat situs web
            </h1>
            <p className="text-oxford-navy-900/70">
                Bagian ini tidak tersedia di aplikasi. Akses akun dan
                pengaturannya dikelola di situs Tartila Book; di aplikasi Anda
                tinggal masuk dan membaca buku yang sudah terbuka untuk akun
                Anda.
            </p>
            {SHOW_WEB_LINK && (
                <Button
                    className="h-12"
                    onClick={() => openExternal(`${WEB_URL}${path}`)}
                >
                    Buka situs web
                </Button>
            )}
            <Link
                to="/katalog"
                className="text-sm font-semibold text-forest-moss-700 underline"
            >
                Kembali ke katalog
            </Link>
        </div>
    );
}
