import { useTranslation } from 'react-i18next';
import { changeLanguage } from './index';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages';

/** Bahasa yang sedang dipakai dan fungsi untuk menggantinya. */
export function useLanguage(): {
    language: Language;
    setLanguage: (language: Language) => Promise<void>;
} {
    const { i18n } = useTranslation();
    const language = isLanguage(i18n.resolvedLanguage)
        ? i18n.resolvedLanguage
        : DEFAULT_LANGUAGE;

    return { language, setLanguage: (next) => changeLanguage(next) };
}
