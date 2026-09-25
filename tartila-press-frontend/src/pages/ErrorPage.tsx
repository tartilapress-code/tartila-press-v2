import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeroHill, HeroLeafRight } from '@/components/art/HeroArt';
import { LanguageChoices } from '@/components/navbar/LanguageSwitcher';

/**
 * Halaman galat: dipakai router untuk kesalahan tak terduga dan langsung oleh
 * halaman detail saat datanya tidak ada (404).
 */
export default function ErrorPage() {
    const { t } = useTranslation();
    const error = useRouteError();
    const notFound =
        !error || (isRouteErrorResponse(error) && error.status === 404);
    // Dipasang router (ada galat) = tampil tanpa navbar, jadi pilihan bahasa
    // disediakan di sini. Kalau dipanggil halaman detail, navbar sudah ada.
    const withoutNavbar = Boolean(error);

    return (
        <div className="relative isolate flex min-h-[72vh] items-center justify-center overflow-hidden bg-white px-6 py-16 text-center">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[24%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[22%] sm:block" />

            <div className="flex max-w-md flex-col items-center gap-4">
                <span className="font-display text-7xl font-bold leading-none text-forest-moss-600">
                    {notFound ? '404' : 'Oops'}
                </span>
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                    {notFound
                        ? t('errors.notFound.title')
                        : t('errors.unexpected.title')}
                </h1>
                <p className="text-[15px] leading-relaxed text-oxford-navy-900/65">
                    {notFound
                        ? t('errors.notFound.text')
                        : t('errors.unexpected.text')}
                </p>
                <Link
                    to="/"
                    className="mt-2 inline-flex items-center justify-center rounded-lg bg-oxford-navy-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                >
                    {t('errors.backHome')}
                </Link>
                {withoutNavbar && (
                    <LanguageChoices className="mt-2 justify-center" />
                )}
            </div>
        </div>
    );
}
