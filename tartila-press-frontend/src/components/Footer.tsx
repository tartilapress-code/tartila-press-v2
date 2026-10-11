import { useTranslation } from 'react-i18next';
import { useAboutPage } from '@/hooks/useAboutPage';
import { SOCIAL_META, contactItems, socialItems } from '@/lib/siteContact';
import Copyrights from './Copyrights';
import Logo from './Logo';

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

export default function Footer() {
    const { t } = useTranslation();
    // Kontak & sosial media dari halaman Tentang Kami (diatur admin).
    const { about } = useAboutPage();
    const { profile } = about;

    const contacts = contactItems(profile);
    const socialMedia = socialItems(profile);

    return (
        <footer
            id="kontak"
            className="mt-12 scroll-mt-24 border-t border-forest-moss-100 bg-forest-moss-50/70"
        >
            <div className="mx-auto max-w-[1232px] px-6 pb-6 pt-10 sm:px-10">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
                    <div className="flex flex-col gap-4">
                        <Logo size="medium" />
                        <p className="max-w-md text-[15px] leading-relaxed text-oxford-navy-900/70">
                            {t('footer.description')}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <ColumnTitle>{t('footer.contact')}</ColumnTitle>

                        <ul className="flex flex-col gap-2.5">
                            {contacts.map((kontak) => (
                                <li
                                    key={kontak.key}
                                    className="flex flex-row items-start gap-3 text-[15px] text-oxford-navy-900/80"
                                >
                                    <i
                                        aria-hidden
                                        className={`${kontak.icon} text-xl leading-none text-oxford-navy-700`}
                                    ></i>
                                    {kontak.href ? (
                                        <a
                                            href={kontak.href}
                                            target={
                                                kontak.href.startsWith('http')
                                                    ? '_blank'
                                                    : undefined
                                            }
                                            rel="noreferrer"
                                            className="break-all transition-colors hover:text-oxford-navy-700 hover:underline"
                                        >
                                            {kontak.label}
                                        </a>
                                    ) : (
                                        <span className="whitespace-pre-line">
                                            {kontak.label}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-4">
                        <ColumnTitle>{t('footer.socialMedia')}</ColumnTitle>

                        <ul className="flex flex-col gap-2.5">
                            {socialMedia.map(({ platform, url }) => (
                                <li key={platform}>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex flex-row items-center gap-3 text-[15px] text-oxford-navy-900/80 transition-colors hover:text-oxford-navy-700 hover:underline"
                                    >
                                        <i
                                            aria-hidden
                                            className={`text-xl text-oxford-navy-700 ${SOCIAL_META[platform].icon}`}
                                        ></i>
                                        {SOCIAL_META[platform].label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <Copyrights />
            </div>
        </footer>
    );
}
