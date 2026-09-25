import { useTranslation } from 'react-i18next';
import {
    formatDate,
    formatList,
    formatNumber,
    formatRupiah,
    DATE_LONG,
    MONTH_YEAR,
} from './format';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages';

/**
 * Format tanggal, angka, Rupiah, dan daftar menurut bahasa yang aktif. Komponen yang
 * menampilkan tanggal/harga wajib memakai hook ini (bukan formatter global)
 * supaya ikut dirender ulang saat bahasa diganti.
 */
export function useFormat(): {
    language: Language;
    rupiah: (amount: number) => string;
    number: (value: number) => string;
    date: (
        value: string | number | Date,
        options?: Intl.DateTimeFormatOptions
    ) => string;
    dateLong: (value: string | number | Date) => string;
    monthYear: (value: string | number | Date) => string;
    list: (items: string[]) => string;
} {
    const { i18n } = useTranslation();
    const language = isLanguage(i18n.resolvedLanguage)
        ? i18n.resolvedLanguage
        : DEFAULT_LANGUAGE;

    return {
        language,
        rupiah: (amount) => formatRupiah(language, amount),
        number: (value) => formatNumber(language, value),
        date: (value, options) => formatDate(language, value, options),
        dateLong: (value) => formatDate(language, value, DATE_LONG),
        monthYear: (value) => formatDate(language, value, MONTH_YEAR),
        list: (items) => formatList(language, items),
    };
}
