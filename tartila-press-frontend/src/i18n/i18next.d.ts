import type { Translation } from './locales/id';

// Kunci terjemahan diketik dari berkas bahasa Indonesia, jadi salah ketik
// kunci di `t('...')` langsung terlihat saat kompilasi.
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: { translation: Translation };
    }
}
