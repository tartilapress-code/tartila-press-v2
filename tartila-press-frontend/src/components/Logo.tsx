import { Link } from 'react-router-dom';
import logo from '../assets/logo/logo.png';
import slogan from '../data/slogan.json';

const sizes = {
    small: 'h-11 min-[1440px]:h-12',
    medium: 'h-14',
    large: 'h-20',
};

type LogoProps = {
    size?: 'small' | 'medium' | 'large';
    // Sembunyikan slogan di bawah nama (mis. di layar yang sempit).
    hideSlogan?: boolean;
    // Kelas tambahan untuk slogan, mis. untuk menyembunyikannya di lebar tertentu.
    sloganClassName?: string;
};

/**
 * Lambang + nama penerbit dengan huruf serif. Tautan ke beranda; untuk latar
 * terang (navbar, footer).
 */
export default function Logo({
    size = 'medium',
    hideSlogan = false,
    sloganClassName = '',
}: LogoProps): React.ReactNode {
    return (
        <Link
            to="/"
            aria-label={`${slogan.name} — beranda`}
            className="flex flex-row items-center gap-3"
        >
            <img
                src={logo}
                alt=""
                className={`w-auto shrink-0 object-contain ${sizes[size]}`}
            />
            <span className="flex flex-col">
                <span className="font-display text-xl font-bold leading-tight text-oxford-navy-700 sm:text-2xl min-[1440px]:text-[1.7rem]">
                    {slogan.name}
                </span>
                {!hideSlogan && (
                    <span
                        className={`font-display whitespace-nowrap text-[11px] leading-snug text-oxford-navy-900/75 sm:text-[13px] ${sloganClassName}`}
                    >
                        {slogan.slogan}.
                    </span>
                )}
            </span>
        </Link>
    );
}
