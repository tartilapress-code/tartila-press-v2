import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logo/logo.png';

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
    // Kelas tambahan untuk tautan logo secara keseluruhan.
    className?: string;
};

/**
 * Lambang + nama penerbit dengan huruf serif. Tautan ke beranda; untuk latar
 * terang (navbar, footer).
 */
export default function Logo({
    size = 'medium',
    hideSlogan = false,
    sloganClassName = '',
    className = '',
}: LogoProps): React.ReactNode {
    const { t } = useTranslation();
    const name = t('common.brand.name');

    return (
        <Link
            to="/"
            aria-label={t('nav.homeLink', { name })}
            className={`flex flex-row items-center gap-3 ${className}`}
        >
            <img
                src={logo}
                alt=""
                className={`w-auto shrink-0 object-contain ${sizes[size]}`}
            />
            <span className="flex flex-col">
                <span className="font-display text-xl font-bold leading-tight text-oxford-navy-700 sm:text-2xl min-[1440px]:text-[1.7rem]">
                    {name}
                </span>
                {!hideSlogan && (
                    <span
                        className={`font-display whitespace-nowrap text-[11px] leading-snug text-oxford-navy-900/75 sm:text-[13px] ${sloganClassName}`}
                    >
                        {t('common.brand.slogan')}.
                    </span>
                )}
            </span>
        </Link>
    );
}
