import {
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type Ref,
} from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ReaderHandle } from '@/components/reader/FlipReader';

// Halaman yang dirender: halaman aktif ± sekian (sisanya hanya kotak kosong).
const RENDER_RADIUS = 3;
const GAP = 16;
const BASE_WIDTH = 820;
const MAX_RENDER_WIDTH = 1700;

function PageCanvas({
    doc,
    page,
    active,
    ratio,
}: {
    doc: PDFDocumentProxy;
    page: number;
    active: boolean;
    ratio: number;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [failed, setFailed] = useState<boolean>(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const box = boxRef.current;

        if (!active || !canvas || !box) return;

        let cancelled = false;
        let task: { cancel: () => void } | null = null;

        void (async () => {
            try {
                const pdfPage = await doc.getPage(page);
                const cssWidth =
                    box.getBoundingClientRect().width || BASE_WIDTH;
                const base = pdfPage.getViewport({ scale: 1 });
                const pixels = Math.min(
                    MAX_RENDER_WIDTH,
                    cssWidth * Math.min(window.devicePixelRatio || 1, 2)
                );
                const viewport = pdfPage.getViewport({
                    scale: pixels / base.width,
                });

                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);

                const context = canvas.getContext('2d', { alpha: false });
                if (!context || cancelled) return;

                const render = pdfPage.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                });
                task = render;
                await render.promise;
                pdfPage.cleanup();
            } catch (caught) {
                // Render dibatalkan saat halaman menjauh: bukan kegagalan.
                if (
                    !cancelled &&
                    (caught as { name?: string })?.name !==
                        'RenderingCancelledException'
                ) {
                    setFailed(true);
                }
            }
        })();

        return () => {
            cancelled = true;
            task?.cancel();
            // Lepas memori kanvas halaman yang sudah jauh.
            canvas.width = 0;
            canvas.height = 0;
        };
    }, [doc, page, active]);

    return (
        <div
            ref={boxRef}
            data-page={page}
            style={{ aspectRatio: String(ratio) }}
            className="relative w-full overflow-hidden bg-[#fbfaf5] shadow-[0_10px_28px_-14px_rgba(1,26,44,0.55)] ring-1 ring-oxford-navy-900/10"
        >
            {!failed && (
                <canvas
                    ref={canvasRef}
                    aria-label={`Halaman ${page}`}
                    className="absolute inset-0 h-full w-full select-none"
                />
            )}
            {failed && (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-oxford-navy-900/50">
                    Halaman {page} gagal dimuat.
                </span>
            )}
            <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
                {page}
            </span>
        </div>
    );
}

/**
 * Mode "gulir": semua halaman berurutan ke bawah. Hanya halaman di sekitar
 * layar yang dirender supaya buku panjang tetap ringan.
 */
export default function ScrollReader({
    doc,
    pageCount,
    ratio,
    zoom,
    initialPage,
    onVisible,
    handleRef,
}: {
    doc: PDFDocumentProxy;
    pageCount: number;
    ratio: number;
    // 1 = lebar normal; 0.8–1.4 mengubah lebar halaman.
    zoom: number;
    initialPage: number;
    onVisible: (pages: number[]) => void;
    handleRef: Ref<ReaderHandle>;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [current, setCurrent] = useState<number>(initialPage);
    const frame = useRef<number | undefined>(undefined);
    const onVisibleRef = useRef(onVisible);
    // Halaman yang sedang dibaca, supaya mengubah lebar tidak melompat.
    const currentRef = useRef<number>(initialPage);

    useEffect(() => {
        onVisibleRef.current = onVisible;
    });

    // Tinggi satu langkah (halaman + jarak), dari kotak halaman pertama.
    const step = useCallback((): number => {
        const first =
            scrollRef.current?.querySelector<HTMLElement>('[data-page="1"]');

        return first ? first.offsetHeight + GAP : 1000;
    }, []);

    const update = useCallback(() => {
        const container = scrollRef.current;

        if (!container) return;

        const size = step();
        const page = Math.min(
            pageCount,
            Math.max(
                1,
                Math.floor(
                    (container.scrollTop + container.clientHeight / 2) / size
                ) + 1
            )
        );

        currentRef.current = page;
        setCurrent(page);
        onVisibleRef.current([page]);
    }, [pageCount, step]);

    useImperativeHandle(
        handleRef,
        () => ({
            goTo: (page) =>
                scrollRef.current?.scrollTo({
                    top: (Math.min(Math.max(page, 1), pageCount) - 1) * step(),
                }),
            next: () =>
                scrollRef.current?.scrollBy({
                    top: scrollRef.current.clientHeight * 0.9,
                    behavior: 'smooth',
                }),
            prev: () =>
                scrollRef.current?.scrollBy({
                    top: -scrollRef.current.clientHeight * 0.9,
                    behavior: 'smooth',
                }),
        }),
        [pageCount, step]
    );

    // Buka di halaman awal, dan sesuaikan lagi bila lebar halaman berubah.
    useEffect(() => {
        const container = scrollRef.current;

        if (!container) return;

        const jump = () =>
            container.scrollTo({ top: (currentRef.current - 1) * step() });
        const timer = window.setTimeout(() => {
            jump();
            update();
        }, 50);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    useEffect(
        () => () => {
            if (frame.current !== undefined)
                cancelAnimationFrame(frame.current);
        },
        []
    );

    return (
        <div
            ref={scrollRef}
            onScroll={() => {
                if (frame.current !== undefined) return;
                frame.current = requestAnimationFrame(() => {
                    frame.current = undefined;
                    update();
                });
            }}
            tabIndex={0}
            aria-label="Isi buku, gulir ke bawah untuk membaca"
            className="h-full overflow-y-auto overscroll-contain px-3 py-4 outline-none"
        >
            <div
                className="mx-auto flex flex-col"
                style={{
                    width: `min(100%, ${Math.round(BASE_WIDTH * zoom)}px)`,
                    gap: GAP,
                }}
            >
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                    (page) => (
                        <PageCanvas
                            key={page}
                            doc={doc}
                            page={page}
                            ratio={ratio}
                            active={Math.abs(page - current) <= RENDER_RADIUS}
                        />
                    )
                )}
            </div>
        </div>
    );
}
