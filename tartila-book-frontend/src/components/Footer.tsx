import { isApp } from '@/lib/platform';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

const PRESS_URL = import.meta.env.VITE_PRESS_URL as string;

function ColumnTitle({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="font-display flex items-center gap-2.5 text-lg font-bold text-oxford-navy-700">
            <span
                aria-hidden
                className="h-5 w-1 shrink-0 rounded-full bg-forest-moss-600"
            />
            {children}
        </h4>
    );
}

const link =
    'text-[15px] text-oxford-navy-900/80 transition-colors hover:text-oxford-navy-700 hover:underline';

export default function Footer() {
    return (
        <footer className="mt-12 border-t border-forest-moss-100 bg-forest-moss-50/70">
            <div className="mx-auto max-w-[1232px] px-6 pb-6 pt-10 sm:px-10">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
                    <div className="flex flex-col gap-4">
                        <Logo />
                        <p className="max-w-md text-[15px] leading-relaxed text-oxford-navy-900/70">
                            Perpustakaan digital buku terbitan Tartila Press.
                            Baca di mana saja, simpan buku favorit, dan
                            berlangganan untuk membaca semuanya.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <ColumnTitle>Jelajah</ColumnTitle>
                        <ul className="flex flex-col gap-2.5">
                            <li>
                                <Link to="/katalog" className={link}>
                                    Katalog buku
                                </Link>
                            </li>
                            {!isApp && (
                                <li>
                                    <Link to="/langganan" className={link}>
                                        Paket langganan
                                    </Link>
                                </li>
                            )}
                            <li>
                                <Link to="/rak" className={link}>
                                    Rak saya
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-4">
                        <ColumnTitle>Tartila Press</ColumnTitle>
                        <ul className="flex flex-col gap-2.5">
                            <li>
                                <a href={PRESS_URL} className={link}>
                                    Penerbit &amp; layanan
                                </a>
                            </li>
                            <li>
                                <a href={`${PRESS_URL}/buku`} className={link}>
                                    Toko buku cetak
                                </a>
                            </li>
                            <li>
                                <a
                                    href={`${PRESS_URL}/tentang-kami`}
                                    className={link}
                                >
                                    Tentang kami &amp; kontak
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <p className="mt-8 border-t border-forest-moss-100 pt-4 text-center text-sm text-oxford-navy-900/60">
                    © {new Date().getFullYear()} Tartila Press. Semua hak
                    dilindungi.
                </p>
            </div>
        </footer>
    );
}
