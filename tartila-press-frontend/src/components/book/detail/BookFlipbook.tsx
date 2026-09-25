import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PageFlip, type FlipSetting } from 'page-flip';
import {
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiCloseLine,
    RiFullscreenLine,
} from '@remixicon/react';
import {
    bookPageCount,
    buildFlipbookPages,
    describePosition,
    flipbookShape,
    indexToPosition,
    positionToIndex,
    type FlipbookLabels,
    type PositionLabel,
} from '@/lib/flipbookPages';
import type { PdfPageStore } from '@/lib/pdfPreview';

export type FlipbookLayout = 'inline' | 'dialog';

type BookFlipbookProps = {
    store: PdfPageStore;
    title: string;
    frontCover: string | null;
    fallbackCover?: string;
    backCover: string | null;
    // inline = sebesar sampul di hero (satu halaman); dialog = layar besar
    // (dua halaman berdampingan bila muat).
    layout: FlipbookLayout;
    // Posisi baca yang dibuka pertama kali: 0 = sampul, 1..N = halaman PDF,
    // N + 1 = sampul belakang (sama di semua layout). Hanya dibaca saat
    // flipbook dibuat.
    initialPage?: number;
    // Buka sampul dengan animasi begitu flipbook tampil (setelah digeser).
    openOnMount?: boolean;
    // Dipanggil tiap halaman berganti dengan posisi baca yang baru (untuk
    // mengingatnya saat pindah layout).
    onPageChange?: (position: number) => void;
    // Hanya untuk layout inline: buka tampilan besar.
    onExpand?: () => void;
    onClose: () => void;
};

const toneClasses = {
    inline: {
        button: 'bg-white text-oxford-navy-700 ring-1 ring-forest-moss-200 hover:bg-forest-moss-50',
        label: 'text-oxford-navy-900/70',
    },
    dialog: {
        button: 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20',
        label: 'text-white/80',
    },
} as const;

function ToolbarButton({
    label,
    tone,
    disabled = false,
    onClick,
    children,
}: {
    label: string;
    tone: FlipbookLayout;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex size-9 items-center justify-center rounded-full transition-colors hover:cursor-pointer disabled:cursor-default disabled:opacity-40 [&>svg]:size-5 ${toneClasses[tone].button}`}
        >
            {children}
        </button>
    );
}

/**
 * Flipbook dari PDF preview: sampul depan, halaman PDF, lalu sampul belakang.
 * Membalik halaman dengan menggeser/mengklik buku, tombol, atau panah
 * keyboard. Gambar halaman dirender bertahap oleh `store`.
 */
export default function BookFlipbook({
    store,
    title,
    frontCover,
    fallbackCover,
    backCover,
    layout,
    initialPage = 0,
    openOnMount = false,
    onPageChange,
    onExpand,
    onClose,
}: BookFlipbookProps) {
    const { t } = useTranslation();
    const hostRef = useRef<HTMLDivElement>(null);
    const flipRef = useRef<PageFlip | null>(null);
    // Nilai awal hanya dipakai saat membuat flipbook; ref menjaga efek di
    // bawah tidak dibangun ulang bila induk mengubahnya.
    const initialPageRef = useRef(initialPage);
    const openOnMountRef = useRef(openOnMount);
    const onPageChangeRef = useRef(onPageChange);

    // Susunan halaman: tampilan dua halaman hanya di layout besar; di sana
    // PDF yang menandai halaman pertamanya di kanan diberi halaman kosong di
    // depan (bagian dalam sampul).
    const shape = flipbookShape(store, layout === 'dialog');

    // Teks di dalam halaman buku (dibuat lewat DOM); berubah hanya saat bahasa diganti.
    const labels = useMemo<FlipbookLabels>(
        () => ({
            endOfPreview: t('books.detail.flipbook.endOfPreview'),
            pageFailed: t('books.detail.flipbook.pageFailed'),
            pageAlt: (page) => t('books.detail.flipbook.pageAlt', { page }),
        }),
        [t]
    );

    function positionText(position: PositionLabel): string {
        switch (position.kind) {
            case 'page':
                return t('books.detail.flipbook.position.page', {
                    page: position.page,
                    total: position.total,
                });
            case 'spread':
                return t('books.detail.flipbook.position.spread', {
                    left: position.left,
                    right: position.right,
                    total: position.total,
                });
            default:
                return t(`books.detail.flipbook.position.${position.kind}`);
        }
    }

    const [view, setView] = useState(() => ({
        index: positionToIndex(initialPage, shape),
        portrait: true,
    }));

    useEffect(() => {
        onPageChangeRef.current = onPageChange;
    });

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const inline = layout === 'inline';
        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        const shape = flipbookShape(store, !inline);
        const { elements, views } = buildFlipbookPages({
            ...shape,
            title,
            frontCover,
            fallbackCover,
            backCover,
            labels,
        });

        // Wadah milik library: dihapus sendiri oleh `destroy()`.
        const root = document.createElement('div');
        root.className =
            'h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none';
        host.appendChild(root);

        const settings: Partial<FlipSetting> = {
            // Hanya rasio A5 yang dipakai; ukuran sebenarnya mengikuti wadah.
            width: 148,
            height: 210,
            size: 'stretch' as FlipSetting['size'],
            // Tampilan satu halaman (potret) dipakai bila lebar wadah
            // < 2 × minWidth: selalu di inline, di bawah ±560px pada dialog.
            minWidth: inline ? 170 : 280,
            maxWidth: 1600,
            minHeight: 200,
            maxHeight: 2400,
            autoSize: false,
            usePortrait: true,
            showCover: true,
            maxShadowOpacity: 0.45,
            flippingTime: reducedMotion ? 250 : 800,
            startPage: positionToIndex(initialPageRef.current, shape),
            mobileScrollSupport: true,
        };

        const flip = new PageFlip(root, settings);
        let disposed = false;

        flip.loadFromHTML(elements);
        // Library memberi wadahnya lebar minimum tetap; buang supaya tidak
        // meluap di layar sempit.
        root.style.minWidth = '0';
        flipRef.current = flip;

        // Sampul dan buku tertutup terlihat di tengah, bukan di separuh kanan.
        function centerBook() {
            const landscape = String(flip.getOrientation()) === 'landscape';
            const index = flip.getCurrentPageIndex();
            const last = flip.getPageCount() - 1;
            const half = flip.getBoundsRect().pageWidth / 2;
            const offset = landscape
                ? index === 0
                    ? -half
                    : index >= last
                      ? half
                      : 0
                : 0;

            root.style.transform = `translate3d(${offset}px, 0, 0)`;
        }

        function sync() {
            if (disposed) return;

            setView({
                index: flip.getCurrentPageIndex(),
                portrait: String(flip.getOrientation()) === 'portrait',
            });
            centerBook();
        }

        // Gambar yang sudah dirender (mis. saat pindah dari inline ke dialog)
        // langsung dipasang; sisanya menyusul lewat langganan.
        views.forEach((pageView, page) => {
            const image = store.getImage(page);
            if (image) pageView.setImage(image);
        });
        const unsubscribe = store.subscribe((page, image) => {
            views.get(page)?.setImage(image);
        });

        function focusStore(position: number) {
            store.focus(Math.min(Math.max(position, 1), store.pageCount));
        }

        focusStore(initialPageRef.current);

        flip.on('init', sync);
        flip.on('changeOrientation', sync);
        flip.on('flip', (event) => {
            const position = indexToPosition(event.data as number, shape);

            focusStore(position);
            onPageChangeRef.current?.(position);
            sync();
        });

        const observer = new ResizeObserver(() => {
            if (disposed) return;

            flip.update();
            centerBook();
        });
        observer.observe(host);

        const openTimer = openOnMountRef.current
            ? window.setTimeout(() => flip.flipNext(), 450)
            : undefined;

        host.focus({ preventScroll: true });

        return () => {
            disposed = true;
            window.clearTimeout(openTimer);
            observer.disconnect();
            unsubscribe();
            flipRef.current = null;
            flip.destroy();
        };
    }, [store, title, frontCover, fallbackCover, backCover, layout, labels]);

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            flipRef.current?.flipNext();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            flipRef.current?.flipPrev();
        } else if (event.key === 'Escape' && layout === 'inline') {
            onClose();
        }
    }

    const tone = layout;
    const lastIndex = bookPageCount(shape) - 1;

    return (
        <div
            className={`flex flex-col items-center gap-3 ${
                layout === 'dialog' ? 'h-full min-h-0 w-full' : 'w-full'
            }`}
        >
            <div
                ref={hostRef}
                tabIndex={0}
                role="group"
                aria-roledescription="flipbook"
                aria-label={t('books.detail.flipbook.aria', { title })}
                onKeyDown={handleKeyDown}
                onPointerDown={() =>
                    hostRef.current?.focus({ preventScroll: true })
                }
                className={`relative w-full rounded outline-none focus-visible:ring-2 focus-visible:ring-forest-moss-600 ${
                    layout === 'inline' ? 'aspect-[148/210]' : 'min-h-0 flex-1'
                }`}
            />

            <div
                role="group"
                aria-label={t('books.detail.flipbook.controls')}
                className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2"
            >
                <div className="flex items-center gap-1">
                    <ToolbarButton
                        label={t('books.detail.flipbook.prev')}
                        tone={tone}
                        disabled={view.index <= 0}
                        onClick={() => flipRef.current?.flipPrev()}
                    >
                        <RiArrowLeftSLine aria-hidden />
                    </ToolbarButton>

                    <span
                        aria-live="polite"
                        className={`min-w-28 text-center text-sm font-medium ${toneClasses[tone].label}`}
                    >
                        {positionText(
                            describePosition(view.index, view.portrait, shape)
                        )}
                    </span>

                    <ToolbarButton
                        label={t('books.detail.flipbook.next')}
                        tone={tone}
                        disabled={view.index >= lastIndex}
                        onClick={() => flipRef.current?.flipNext()}
                    >
                        <RiArrowRightSLine aria-hidden />
                    </ToolbarButton>
                </div>

                <div className="flex items-center gap-1">
                    {onExpand && (
                        <ToolbarButton
                            label={t('books.detail.flipbook.expand')}
                            tone={tone}
                            onClick={onExpand}
                        >
                            <RiFullscreenLine aria-hidden />
                        </ToolbarButton>
                    )}

                    <ToolbarButton
                        label={
                            layout === 'inline'
                                ? t('books.detail.flipbook.closePreview')
                                : t('books.detail.flipbook.closeLarge')
                        }
                        tone={tone}
                        onClick={onClose}
                    >
                        <RiCloseLine aria-hidden />
                    </ToolbarButton>
                </div>
            </div>
        </div>
    );
}
