import { useEffect, useState } from 'react';
import * as aboutApi from '@/data/about/aboutApi';
import type { AboutPage } from '@/data/about/aboutApi';
import { DEFAULT_ABOUT_PAGE } from '@/lib/siteContact';

// Satu permintaan untuk semua pemakai (halaman Tentang Kami, footer, tombol
// WhatsApp) selama halaman terbuka.
let cache: AboutPage | null = null;
let pending: Promise<AboutPage> | null = null;

function load(): Promise<AboutPage> {
    pending ??= aboutApi
        .get()
        .then((response) => {
            cache = response.data as AboutPage;

            return cache;
        })
        .catch(() => {
            pending = null;

            return DEFAULT_ABOUT_PAGE;
        });

    return pending;
}

/** Data dimuat ulang pada pemakaian berikutnya (setelah admin menyimpan). */
export function invalidateAboutPage(): void {
    cache = null;
    pending = null;
}

/**
 * Isi halaman "Tentang Kami" (kontak, sosial media, legalitas, tim). Selama
 * memuat / bila gagal, `about` berisi kontak bawaan.
 */
export function useAboutPage() {
    const [about, setAbout] = useState<AboutPage>(cache ?? DEFAULT_ABOUT_PAGE);
    const [isLoading, setIsLoading] = useState<boolean>(cache === null);

    useEffect(() => {
        let active = true;

        load()
            .then((data) => {
                if (active) setAbout(data);
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    return { about, isLoading };
}
