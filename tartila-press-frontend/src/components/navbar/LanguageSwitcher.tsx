import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiArrowDownSLine, RiCheckLine, RiGlobalLine } from '@remixicon/react';
import { useDismiss } from '@/hooks/useDismiss';
import { LANGUAGES, LANGUAGE_META, type Language } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';

/**
 * Pilihan bahasa berupa deret tombol (menu ponsel, halaman galat). Pilihan
 * disimpan di browser oleh `changeLanguage`.
 */
export function LanguageChoices({
    onSelect,
    className = '',
}: {
    onSelect?: () => void;
    className?: string;
}) {
    const { t } = useTranslation();
    const { language, setLanguage } = useLanguage();

    function choose(code: Language) {
        void setLanguage(code).catch(() => undefined);
        onSelect?.();
    }

    return (
        <div
            role="group"
            aria-label={t('nav.language.choose')}
            className={`flex flex-row flex-wrap items-center gap-2 ${className}`}
        >
            {LANGUAGES.map((code) => (
                <button
                    key={code}
                    type="button"
                    lang={code}
                    aria-pressed={code === language}
                    onClick={() => choose(code)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:cursor-pointer ${
                        code === language
                            ? 'border-oxford-navy-700 bg-oxford-navy-700 text-white'
                            : 'border-oxford-navy-200 bg-white text-oxford-navy-700 hover:bg-forest-moss-50'
                    }`}
                >
                    {LANGUAGE_META[code].name}
                </button>
            ))}
        </div>
    );
}

/**
 * Tombol bahasa di navbar (ikon bumi + kode bahasa) yang membuka daftar
 * bahasa yang tersedia.
 */
export default function LanguageSwitcher() {
    const { t } = useTranslation();
    const { language, setLanguage } = useLanguage();
    const [open, setOpen] = useState<boolean>(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useDismiss(open, () => setOpen(false), rootRef);

    function choose(code: Language) {
        setOpen(false);
        void setLanguage(code).catch(() => undefined);
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={t('nav.language.choose')}
                className="inline-flex h-10 items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-oxford-navy-900 transition-colors hover:cursor-pointer hover:bg-forest-moss-50 hover:text-oxford-navy-700"
            >
                <RiGlobalLine aria-hidden className="size-5" />
                <span className="group-data-[lang=short]/nav:hidden">
                    {LANGUAGE_META[language].short}
                </span>
                <RiArrowDownSLine
                    aria-hidden
                    className={`size-4 shrink-0 transition-transform group-data-[lang=short]/nav:hidden ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {open && (
                <ul
                    role="menu"
                    aria-label={t('nav.language.choose')}
                    className="absolute right-0 top-full z-50 mt-3 w-52 rounded-2xl border border-forest-moss-100 bg-white p-2 shadow-[0_12px_32px_-12px_rgba(1,26,44,0.35)]"
                >
                    {LANGUAGES.map((code) => (
                        <li key={code} role="none">
                            <button
                                type="button"
                                role="menuitemradio"
                                lang={code}
                                aria-checked={code === language}
                                onClick={() => choose(code)}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:cursor-pointer ${
                                    code === language
                                        ? 'bg-forest-moss-100 font-semibold text-oxford-navy-700'
                                        : 'font-medium text-oxford-navy-900/85 hover:bg-forest-moss-50 hover:text-oxford-navy-700'
                                }`}
                            >
                                {LANGUAGE_META[code].name}
                                {code === language && (
                                    <RiCheckLine
                                        aria-hidden
                                        className="size-5 shrink-0 text-forest-moss-700"
                                    />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
