import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

/** True saat berjalan sebagai aplikasi Android (Capacitor), false di peramban. */
export const isApp: boolean = Capacitor.isNativePlatform();

/** Alamat situs Tartila Book di web (untuk tautan keluar dari aplikasi). */
export const WEB_URL =
    (import.meta.env.VITE_WEB_URL as string | undefined) ?? '';

/**
 * Tautan "kelola di situs web" di aplikasi. Mati secara bawaan: aturan toko aplikasi untuk
 * konten digital bisa melarang mengarahkan pengguna ke pembayaran di luar toko, jadi aplikasi
 * hanya memakai teks netral. Nyalakan dengan VITE_APP_SHOW_WEB_LINK=true bila sudah dipastikan boleh.
 */
export const SHOW_WEB_LINK: boolean =
    import.meta.env.VITE_APP_SHOW_WEB_LINK === 'true' && WEB_URL !== '';

/** Buka alamat di peramban sistem (aplikasi) atau tab baru (web). */
export function openExternal(url: string): void {
    if (isApp) {
        void Browser.open({ url });
    } else {
        window.open(url, '_blank', 'noopener');
    }
}

/**
 * Pasang perilaku khusus aplikasi: tautan keluar domain dibuka di peramban sistem (bukan
 * menggantikan layar aplikasi), dan tombol kembali Android mengikuti riwayat halaman.
 */
export function initNativeApp(): void {
    if (!isApp) return;

    document.addEventListener('click', (event) => {
        const anchor = (event.target as Element | null)?.closest('a[href]');

        if (!(anchor instanceof HTMLAnchorElement)) return;

        const url = new URL(anchor.href, window.location.href);

        if (
            url.origin !== window.location.origin &&
            /^https?:$/.test(url.protocol)
        ) {
            event.preventDefault();
            openExternal(url.href);
        }
    });

    void App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
            window.history.back();
        } else {
            void App.exitApp();
        }
    });
}
