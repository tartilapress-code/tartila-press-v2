// Bahasa yang didukung situs. Indonesia adalah bahasa sumber sekaligus bawaan.
export const LANGUAGES = ['id', 'en', 'ms'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE = 'id' as const satisfies Language;

// `name`: nama bahasa di bahasanya sendiri (pemilih bahasa); `short`: kode
// ringkas di tombol; `intl`: lokal untuk format tanggal dan angka.
export const LANGUAGE_META: Record<
    Language,
    { name: string; short: string; intl: string }
> = {
    id: { name: 'Bahasa Indonesia', short: 'ID', intl: 'id-ID' },
    en: { name: 'English', short: 'EN', intl: 'en-GB' },
    ms: { name: 'Bahasa Melayu', short: 'MS', intl: 'ms-MY' },
};

export function isLanguage(value: unknown): value is Language {
    return LANGUAGES.some((language) => language === value);
}
