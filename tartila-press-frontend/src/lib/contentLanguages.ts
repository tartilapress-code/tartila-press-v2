// Bahasa isi buku / proyek Book Chapter dan bahasa yang dikuasai editor.
// Ini BUKAN bahasa tampilan situs (lihat `i18n/languages.ts`).
//
// Daftar dan urutannya harus sama dengan `App\Support\Languages::CODES` di
// backend (kode di luar daftar ditolak server). Nama tiap bahasa ada di
// terjemahan `contentLanguages.names`, jadi menambah bahasa berarti menambah
// kodenya di dua daftar kode itu dan namanya di ketiga berkas terjemahan.
export const CONTENT_LANGUAGES = [
    'id',
    'en',
    'ms',
    'ar',
    'jv',
    'su',
    'min',
    'ban',
    'zh',
    'ja',
    'ko',
    'hi',
    'th',
    'vi',
    'fa',
    'tr',
    'de',
    'fr',
    'nl',
    'es',
    'pt',
    'it',
    'ru',
] as const;

export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export function isContentLanguage(value: unknown): value is ContentLanguage {
    return CONTENT_LANGUAGES.some((code) => code === value);
}

/**
 * Daftar kode dari server → daftar yang aman dipakai: kode tak dikenal
 * dibuang dan urutannya mengikuti CONTENT_LANGUAGES. Kosong bila datanya
 * belum ada.
 */
export function toContentLanguages(value: unknown): ContentLanguage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return CONTENT_LANGUAGES.filter((code) => value.includes(code));
}
