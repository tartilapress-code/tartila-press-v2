import { useLayoutEffect, type RefObject } from 'react';

// Tampilan navbar dari yang paling lega ke yang paling rapat. Dicoba satu per
// satu sampai isinya muat; kalau tidak ada yang muat, navbar menjadi menu
// hamburger. Lebar teks menu berbeda tiap bahasa (dan tiap nama pengguna), jadi
// muat-tidaknya diukur langsung, bukan ditebak dari lebar layar.
const STEPS = [
    { gap: 28, tagline: true, langLabel: true, wideUser: true },
    { gap: 24, tagline: true, langLabel: true, wideUser: true },
    { gap: 20, tagline: true, langLabel: true, wideUser: true },
    { gap: 16, tagline: true, langLabel: true, wideUser: true },
    { gap: 16, tagline: false, langLabel: true, wideUser: true },
    { gap: 12, tagline: false, langLabel: true, wideUser: true },
    { gap: 12, tagline: false, langLabel: false, wideUser: true },
    { gap: 12, tagline: false, langLabel: false, wideUser: false },
] as const;

const onOff = (value: boolean) => (value ? 'on' : 'off');

/**
 * Memilih tampilan navbar yang muat dan mencatatnya di atribut data pada
 * <header>: `data-collapsed` (menu hamburger), `data-tagline`, `data-lang`,
 * `data-user` (tombol nama pengguna dipersempit), dan variabel CSS `--nav-gap`
 * (jarak antar tautan). Gaya turunannya ada di Navbar.
 *
 * `signature` berubah saat isi navbar berubah (bahasa, status login, nama
 * pengguna) supaya diukur ulang. `onExpand` dipanggil saat navbar kembali dari
 * hamburger ke menu penuh (mis. jendela dilebarkan).
 */
export function useNavbarFit(
    ref: RefObject<HTMLElement | null>,
    onExpand: () => void,
    signature: string
): void {
    useLayoutEffect(() => {
        const header = ref.current;
        const nav = header?.querySelector('nav');

        if (!header || !nav) {
            return;
        }

        const children = () => Array.from(nav.children);

        const fits = () => {
            const paddingRight =
                parseFloat(getComputedStyle(nav).paddingRight) || 0;
            const limit = nav.getBoundingClientRect().right - paddingRight;
            const right = Math.max(
                ...children().map(
                    (child) => child.getBoundingClientRect().right
                )
            );

            return right <= limit + 0.5;
        };

        const sizes = () =>
            children()
                .map((child) => Math.round(child.getBoundingClientRect().width))
                .join(',');

        let lastSizes = '';

        const fit = () => {
            const wasCollapsed = header.dataset.collapsed === 'on';
            let collapsed = true;

            header.dataset.collapsed = 'off';

            for (const step of STEPS) {
                header.style.setProperty('--nav-gap', `${step.gap}px`);
                header.dataset.tagline = onOff(step.tagline);
                header.dataset.lang = step.langLabel ? 'full' : 'short';
                header.dataset.user = step.wideUser ? 'wide' : 'narrow';

                if (fits()) {
                    collapsed = false;
                    break;
                }
            }

            if (collapsed) {
                header.dataset.collapsed = 'on';
                header.dataset.tagline = 'on';
                header.dataset.lang = 'full';
                header.dataset.user = 'wide';
            } else if (wasCollapsed) {
                onExpand();
            }

            lastSizes = sizes();
        };

        // Ukur ulang hanya bila ukuran isi berubah (lebar jendela, font web
        // selesai dimuat, gambar logo termuat), supaya tidak berputar sendiri.
        const refit = () => {
            if (sizes() !== lastSizes) {
                fit();
            }
        };

        let active = true;

        fit();

        const observer = new ResizeObserver(refit);
        observer.observe(nav);
        children().forEach((child) => observer.observe(child));
        window.addEventListener('resize', fit);
        void document.fonts?.ready.then(() => {
            if (active) {
                fit();
            }
        });

        return () => {
            active = false;
            observer.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, [ref, onExpand, signature]);
}
