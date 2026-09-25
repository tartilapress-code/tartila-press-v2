import { useTranslation } from 'react-i18next';
import { useFormat } from '@/i18n/useFormat';
import type { ContentLanguage } from '@/lib/contentLanguages';

/**
 * Nama bahasa isi (buku / bahasa yang dikuasai editor) dalam bahasa tampilan
 * yang sedang aktif. Komponen yang menampilkannya wajib memakai hook ini supaya
 * ikut dirender ulang saat bahasa situs diganti.
 */
export function useContentLanguages() {
    const { t } = useTranslation();
    const { list } = useFormat();

    const name = (code: ContentLanguage): string =>
        t(`contentLanguages.names.${code}`);

    return {
        name,
        /** "Indonesia dan Inggris" */
        sentence: (codes: readonly ContentLanguage[]): string =>
            list(codes.map(name)),
        /** "Bahasa: Indonesia dan Inggris" (tunggal/jamak mengikuti jumlahnya) */
        metaLine: (codes: readonly ContentLanguage[]): string =>
            t('contentLanguages.metaLine', {
                count: codes.length,
                languages: list(codes.map(name)),
            }),
        /** "Bahasa yang dikuasai: Indonesia dan Inggris" (profil editor) */
        masteredLine: (codes: readonly ContentLanguage[]): string =>
            t('contentLanguages.masteredLine', {
                languages: list(codes.map(name)),
            }),
        /** Judul baris rincian: "Bahasa" / "Language" / "Languages" */
        factLabel: (codes: readonly ContentLanguage[]): string =>
            t('contentLanguages.factLabel', { count: codes.length }),
    };
}
