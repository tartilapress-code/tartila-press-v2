import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id, { type Translation } from './locales/id';
import {
    DEFAULT_LANGUAGE,
    LANGUAGES,
    isLanguage,
    type Language,
} from './languages';

const STORAGE_KEY = 'tartila_lang';

// Bahasa selain Indonesia baru diunduh saat dipilih, supaya paket awal kecil.
const loaders: Record<
    Exclude<Language, 'id'>,
    () => Promise<{ default: Translation }>
> = {
    en: () => import('./locales/en'),
    ms: () => import('./locales/ms'),
};

function readStoredLanguage(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
        return DEFAULT_LANGUAGE;
    }
}

function storeLanguage(language: Language): void {
    try {
        localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // Penyimpanan diblokir: pilihan berlaku sampai halaman ditutup.
    }
}

// Penanda klik terakhir, supaya bahasa yang lambat diunduh tidak menimpa
// pilihan yang lebih baru.
let latestRequest = 0;

/**
 * Ganti bahasa situs. Bahasa yang belum dimuat diunduh dulu; pilihan disimpan
 * di browser dan atribut `lang` pada <html> ikut diperbarui.
 */
export async function changeLanguage(
    language: Language,
    persist = true
): Promise<void> {
    const request = ++latestRequest;

    if (
        language !== DEFAULT_LANGUAGE &&
        !i18n.hasResourceBundle(language, 'translation')
    ) {
        const bundle = await loaders[language]();
        i18n.addResourceBundle(
            language,
            'translation',
            bundle.default,
            true,
            true
        );
    }

    if (request !== latestRequest) {
        return;
    }

    await i18n.changeLanguage(language);
    document.documentElement.lang = language;

    if (persist) {
        storeLanguage(language);
    }
}

/** Menyiapkan terjemahan sebelum aplikasi ditampilkan (tanpa kedip bahasa). */
export async function initI18n(): Promise<void> {
    await i18n.use(initReactI18next).init({
        resources: { id: { translation: id } },
        lng: DEFAULT_LANGUAGE,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...LANGUAGES],
        defaultNS: 'translation',
        interpolation: { escapeValue: false },
    });

    try {
        await changeLanguage(readStoredLanguage(), false);
    } catch {
        // Berkas bahasa gagal diunduh: tetap pakai bahasa Indonesia.
        document.documentElement.lang = DEFAULT_LANGUAGE;
    }
}
