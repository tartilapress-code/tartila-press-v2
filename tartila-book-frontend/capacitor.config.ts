import type { CapacitorConfig } from '@capacitor/cli';

// Aplikasi Android Tartila Book = situs Tartila Book yang sama (build "vite build --mode app")
// dibungkus WebView. Hanya login & membaca; pembelian dan langganan dikelola di situs web.
const config: CapacitorConfig = {
    appId: 'com.tartilapress.book',
    appName: 'Tartila Book',
    webDir: 'dist',
    android: {
        // Berkas PDF dan API diakses lewat HTTPS; jangan izinkan lalu lintas polos di versi rilis.
        allowMixedContent: false,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 800,
            backgroundColor: '#ffffff',
            showSpinner: false,
        },
        StatusBar: {
            style: 'LIGHT',
            backgroundColor: '#ffffff',
            overlaysWebView: false,
        },
    },
};

export default config;
