import { LANGUAGE_META, type Language } from './languages';

const currencyFormats = new Map<Language, Intl.NumberFormat>();
const numberFormats = new Map<Language, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const listFormats = new Map<Language, Intl.ListFormat>();

/** Tanggal panjang: "24 September 2026". */
export const DATE_LONG: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
};

/** Bulan dan tahun: "September 2026". */
export const MONTH_YEAR: Intl.DateTimeFormatOptions = {
    month: 'long',
    year: 'numeric',
};

/**
 * Rupiah sesuai kebiasaan tiap bahasa: "Rp 1.000.000" (Indonesia) dan
 * "Rp 1,000,000" (Inggris, Melayu). Harga selalu dalam Rupiah.
 */
export function formatRupiah(language: Language, amount: number): string {
    let format = currencyFormats.get(language);

    if (!format) {
        format = new Intl.NumberFormat(LANGUAGE_META[language].intl, {
            style: 'currency',
            currency: 'IDR',
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
        });
        currencyFormats.set(language, format);
    }

    return format.format(amount);
}

/** Angka biasa dengan pemisah ribuan sesuai bahasa. */
export function formatNumber(language: Language, value: number): string {
    let format = numberFormats.get(language);

    if (!format) {
        format = new Intl.NumberFormat(LANGUAGE_META[language].intl);
        numberFormats.set(language, format);
    }

    return format.format(value);
}

/** Tanggal (dan/atau jam) sesuai bahasa; `options` bawaannya tanggal panjang. */
export function formatDate(
    language: Language,
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = DATE_LONG
): string {
    const key = `${language}:${JSON.stringify(options)}`;
    let format = dateFormats.get(key);

    if (!format) {
        format = new Intl.DateTimeFormat(LANGUAGE_META[language].intl, options);
        dateFormats.set(key, format);
    }

    return format.format(new Date(value));
}

/**
 * Menggabungkan beberapa teks menjadi satu kalimat menurut bahasa:
 * "Indonesia dan Inggris", "Indonesian, English, and Arabic".
 */
export function formatList(language: Language, items: string[]): string {
    let format = listFormats.get(language);

    if (!format) {
        format = new Intl.ListFormat(LANGUAGE_META[language].intl, {
            style: 'long',
            type: 'conjunction',
        });
        listFormats.set(language, format);
    }

    return format.format(items);
}
