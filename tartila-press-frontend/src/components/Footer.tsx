import { useTranslation } from 'react-i18next';
import socialMedia from '../data/footer-social-media.json';
import contacts from '../data/footer-kontak.json';
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
                                    key={kontak.id}
                                    className="flex flex-row items-center gap-3 text-[15px] text-oxford-navy-900/80"
                                >
                                    <i
                                        aria-hidden
                                        className={`${kontak.icon} text-oxford-navy-700`}
                                    ></i>
                                    <span>{kontak.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-4">
                        <ColumnTitle>{t('footer.socialMedia')}</ColumnTitle>

                        <ul className="flex flex-col gap-2.5">
                            {socialMedia.map((media) => (
                                <li key={media.id}>
                                    <a
                                        href={media.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex flex-row items-center gap-3 text-[15px] text-oxford-navy-900/80 transition-colors hover:text-oxford-navy-700 hover:underline"
                                    >
                                        <i
                                            aria-hidden
                                            className={`text-xl text-oxford-navy-700 ${media.icon}`}
                                        ></i>
                                        {media.name}
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
