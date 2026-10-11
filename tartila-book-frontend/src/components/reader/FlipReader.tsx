import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { PageFlip, type FlipSetting } from 'page-flip';
import type { PageImage, PdfPageStore } from '@/lib/pdfPages';

export type ReaderHandle = {
    goTo: (page: number) => void;
    next: () => void;
    prev: () => void;
};

type PageView = { setImage: (image: PageImage) => void };

const PAPER =
    'relative overflow-hidden bg-[#fbfaf5] shadow-[0_10px_28px_-14px_rgba(1,26,44,0.55)] ring-1 ring-oxford-navy-900/10';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
    const node = document.createElement(tag);
    node.className = className;

    return node;
}

// Halaman dibuat lewat DOM biasa karena page-flip memindahkan/menggandakan
// elemennya; React tidak boleh ikut memilikinya.
function buildPage(pageNumber: number): { page: HTMLElement; view: PageView } {
    const page = el('div', PAPER);
    const spinner = el(
        'span',
        'absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-forest-moss-200 border-t-forest-moss-600'
    );
    const failure = el(
        'span',
        'absolute inset-x-0 top-1/2 hidden -translate-y-1/2 px-6 text-center text-xs text-oxford-navy-900/50'
    );
    failure.textContent = 'Halaman gagal dimuat.';

    const image = el(
        'img',
        'absolute inset-0 h-full w-full select-none object-contain opacity-0 transition-opacity duration-200'
    );
    image.alt = `Halaman ${pageNumber}`;
    image.draggable = false;
    image.addEventListener('load', () => {
        image.classList.remove('opacity-0');
        spinner.classList.add('hidden');
    });

    page.append(spinner, failure, image);

    return {
        page,
        view: {
            setImage(pageImage) {
                if (pageImage.kind === 'ready') {
                    failure.classList.add('hidden');
                    image.src = pageImage.url;

                    return;
                }

                image.removeAttribute('src');
                image.classList.add('opacity-0');
                spinner.classList.toggle('hidden', pageImage.kind === 'failed');
                failure.classList.toggle('hidden', pageImage.kind !== 'failed');
            },
        },
    };
}

/**
 * Mode "balik halaman": buku yang dibalik dengan geser/klik/panah. Dua halaman
 * berdampingan di layar lebar, satu halaman di layar sempit. Halaman PDF
 * dirender bertahap (hanya sekitar halaman aktif).
 */
export default function FlipReader({
    store,
    ratio,
    initialPage,
    onVisible,
    handleRef,
}: {
    store: PdfPageStore;
    // lebar / tinggi halaman pertama
    ratio: number;
    initialPage: number;
    // Halaman PDF (mulai 1) yang sedang tampil.
    onVisible: (pages: number[]) => void;
    handleRef: Ref<ReaderHandle>;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const flipRef = useRef<PageFlip | null>(null);
    const initialRef = useRef(initialPage);
    const onVisibleRef = useRef(onVisible);

    useEffect(() => {
        onVisibleRef.current = onVisible;
    });

    useImperativeHandle(
        handleRef,
        () => ({
            // page-flip: indeks mulai 0, tanpa animasi untuk lompatan jauh.
            goTo: (page) => flipRef.current?.turnToPage(Math.max(0, page - 1)),
            next: () => flipRef.current?.flipNext(),
            prev: () => flipRef.current?.flipPrev(),
        }),
        []
    );

    useEffect(() => {
        const host = hostRef.current;

        if (!host) return;

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        const built = Array.from({ length: store.pageCount }, (_, i) =>
            buildPage(i + 1)
        );
        const root = document.createElement('div');
        root.className = 'h-full w-full';
        host.appendChild(root);

        const settings: Partial<FlipSetting> = {
            width: 1000,
            height: Math.round(1000 / (ratio || 0.7)),
            size: 'stretch' as FlipSetting['size'],
            minWidth: 280,
            maxWidth: 1800,
            minHeight: 300,
            maxHeight: 2600,
            autoSize: false,
            usePortrait: true,
            // Halaman 1 berdiri sendiri (sampul), lalu dua-dua.
            showCover: true,
            maxShadowOpacity: 0.4,
            flippingTime: reducedMotion ? 250 : 700,
            startPage: Math.max(0, initialRef.current - 1),
            mobileScrollSupport: true,
        };

        const flip = new PageFlip(root, settings);
        let disposed = false;

        flip.loadFromHTML(built.map((item) => item.page));
        root.style.minWidth = '0';
        flipRef.current = flip;

        const visiblePages = (): number[] => {
            const index = flip.getCurrentPageIndex();
            const landscape = String(flip.getOrientation()) === 'landscape';

            // Mode dua halaman: halaman 1 sendiri, lalu (2,3), (4,5), ...
            const pages =
                landscape && index > 0 ? [index + 1, index + 2] : [index + 1];

            return pages.filter((page) => page >= 1 && page <= store.pageCount);
        };

        const sync = () => {
            if (disposed) return;

            const pages = visiblePages();
            store.focus(pages[0] ?? 1);
            onVisibleRef.current(pages);
        };

        built.forEach((item, i) => {
            const image = store.getImage(i + 1);
            if (image) item.view.setImage(image);
        });
        const unsubscribe = store.subscribe((page, image) => {
            built[page - 1]?.view.setImage(image);
        });

        store.focus(initialRef.current);

        flip.on('init', sync);
        flip.on('flip', sync);
        flip.on('changeOrientation', sync);

        const observer = new ResizeObserver(() => {
            if (!disposed) flip.update();
        });
        observer.observe(host);
        host.focus({ preventScroll: true });

        return () => {
            disposed = true;
            observer.disconnect();
            unsubscribe();
            flipRef.current = null;
            flip.destroy();
        };
    }, [store, ratio]);

    return (
        <div
            ref={hostRef}
            tabIndex={0}
            role="group"
            aria-roledescription="buku balik halaman"
            aria-label="Buku, balik halaman dengan geser, klik, atau tombol panah"
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    flipRef.current?.flipNext();
                } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    flipRef.current?.flipPrev();
                }
            }}
            onPointerDown={() =>
                hostRef.current?.focus({ preventScroll: true })
            }
            className="relative h-full min-h-0 w-full outline-none"
        />
    );
}
