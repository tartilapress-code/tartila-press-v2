import { Link } from 'react-router-dom';
import logo from '@/assets/logo/logo.png';

/** Lambang + nama "Tartila Book" dengan huruf serif, sama gayanya dengan Tartila Press. */
export default function Logo({
    hideSlogan = false,
    className = '',
}: {
    hideSlogan?: boolean;
    className?: string;
}) {
    return (
        <Link
            to="/"
            aria-label="Tartila Book, ke beranda"
            className={`flex flex-row items-center gap-3 ${className}`}
        >
            <img
                src={logo}
                alt=""
                className="h-11 w-auto shrink-0 object-contain"
            />
            <span className="flex flex-col">
                <span className="font-display text-xl font-bold leading-tight text-oxford-navy-700 sm:text-2xl">
                    Tartila Book
                </span>
                {!hideSlogan && (
                    <span className="font-display whitespace-nowrap text-[11px] leading-snug text-oxford-navy-900/75 sm:text-[13px]">
                        Baca, simpan, dan berlangganan.
                    </span>
                )}
            </span>
        </Link>
    );
}
