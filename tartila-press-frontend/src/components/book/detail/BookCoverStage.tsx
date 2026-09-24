import {
    lazy,
    Suspense,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
} from 'react';
import { RiArrowLeftRightLine, RiExternalLinkLine } from '@remixicon/react';
import BookCover from '@/components/book/catalog/BookCover';
import FlipbookDialog from '@/components/book/detail/FlipbookDialog';
import { usePdfPreview } from '@/hooks/usePdfPreview';

// Flipbook (page-flip) dipisah ke berkas tersendiri supaya hanya diunduh
// saat pembaca membuka preview.
const BookFlipbook = lazy(
    () => import('@/components/book/detail/BookFlipbook')
);

// Lebar sampul di hero; tinggi mengikuti rasio A5.
const STAGE_WIDTH = 'w-64 lg:w-72 2xl:w-80';

// Geser minimal (px) yang dianggap membuka sampul, dan batas geser yang
// masih diikuti animasi.
const OPEN_DISTANCE = 56;
const MAX_DRAG = 160;

const chipClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-forest-moss-200 bg-white/70 px-3 py-2 text-sm font-medium text-forest-moss-800 transition-colors hover:cursor-pointer hover:bg-forest-moss-100';

type BookCoverStageProps = {
    title: string;
    frontCover: string | null;
    // Sampul cadangan (mis. sampul bawaan Book Chapter).
    fallbackCover?: string;
    backCover: string | null;
    discount: number;
    // Alamat PDF preview lewat API; null bila buku tidak punya preview.
    previewApiUrl: string | null;
    // Alamat langsung berkas PDF, untuk tautan cadangan bila flipbook gagal.
    previewFileUrl: string | null;
};

/**
 * Sampul buku di hero: besar, membesar saat di-hover, dan bila buku punya PDF
 * preview, menggesernya (atau mengkliknya) mengubahnya menjadi flipbook yang
 * halamannya diambil dari PDF itu. Tombol "Perbesar" membuka flipbook di
 * layar penuh.
 */
export default function BookCoverStage({
    title,
    frontCover,
    fallbackCover,
    backCover,
    discount,
    previewApiUrl,
    previewFileUrl,
}: BookCoverStageProps) {
    const canPreview = previewApiUrl !== null;

    const [mode, setMode] = useState<'cover' | 'flipbook'>('cover');
    // Setelah pernah dibuka, PDF tetap dimuat sampai halaman ditinggalkan
    // supaya membuka ulang preview langsung tampil.
    const [everOpened, setEverOpened] = useState<boolean>(false);
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    // Setiap perubahan sesi membuat ulang flipbook dari halaman `startPage`.
    const [session, setSession] = useState({
        id: 0,
        startPage: 0,
        animateOpen: false,
    });
    const [drag, setDrag] = useState({ active: false, dx: 0 });

    const currentPageRef = useRef(0);
    const coverRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef(false);
    const dragRef = useRef<{
        startX: number;
        startY: number;
        pointerId: number;
        active: boolean;
    } | null>(null);
    const suppressClickRef = useRef(false);

    // Naik setiap kali pembaca membuka ulang preview yang sebelumnya gagal.
    const [attempt, setAttempt] = useState<number>(0);

    const preview = usePdfPreview(
        previewApiUrl ?? '',
        canPreview && everOpened,
        attempt
    );

    // Setelah preview ditutup, fokus keyboard kembali ke sampul.
    useEffect(() => {
        if (mode === 'cover' && restoreFocusRef.current) {
            restoreFocusRef.current = false;
            coverRef.current?.focus({ preventScroll: true });
        }
    }, [mode]);

    function openFlipbook() {
        if (!canPreview) return;

        currentPageRef.current = 0;
        setSession((prev) => ({
            id: prev.id + 1,
            startPage: 0,
            animateOpen: true,
        }));
        setEverOpened(true);
        if (preview.status === 'error') setAttempt((prev) => prev + 1);
        setMode('flipbook');
    }

    function closeFlipbook() {
        restoreFocusRef.current = true;
        setDialogOpen(false);
        setMode('cover');
    }

    // Pindah antara flipbook di hero dan tampilan besar tanpa kehilangan
    // halaman yang sedang dibaca.
    function switchLayout(toDialog: boolean) {
        setSession((prev) => ({
            id: prev.id + 1,
            startPage: currentPageRef.current,
            animateOpen: false,
        }));
        setDialogOpen(toDialog);
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!canPreview) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId,
            active: false,
        };
        suppressClickRef.current = false;
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const gesture = dragRef.current;

        if (!gesture) return;

        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;

        if (!gesture.active) {
            // Hanya geseran mendatar yang berarti; gulir vertikal dibiarkan.
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;

            gesture.active = true;
            event.currentTarget.setPointerCapture(gesture.pointerId);
        }

        setDrag({
            active: true,
            dx: Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx)),
        });
    }

    function finishDrag(event: PointerEvent<HTMLDivElement>) {
        const gesture = dragRef.current;
        dragRef.current = null;

        if (!gesture?.active) return;

        // Klik yang menyusul geseran tidak boleh membuka preview dua kali.
        suppressClickRef.current = true;
        setDrag({ active: false, dx: 0 });

        const distance = Math.abs(event.clientX - gesture.startX);

        if (event.type === 'pointerup' && distance >= OPEN_DISTANCE) {
            openFlipbook();
        }
    }

    function handleClick() {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }

        openFlipbook();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!canPreview) return;

        if (
            event.key === 'Enter' ||
            event.key === ' ' ||
            event.key === 'ArrowLeft' ||
            event.key === 'ArrowRight'
        ) {
            event.preventDefault();
            openFlipbook();
        }
    }

    const showInlineFlipbook =
        mode === 'flipbook' && preview.status === 'ready' && !dialogOpen;
    const isLoading =
        mode === 'flipbook' &&
        (preview.status === 'idle' || preview.status === 'loading');
    // Kemiringan sampul mengikuti geseran, seperti sampul buku yang dibuka.
    const angle = drag.dx < 0 ? drag.dx * 0.25 : drag.dx * 0.08;

    const store = preview.status === 'ready' ? preview.store : null;

    // Mengingat halaman yang sedang dibaca, untuk pindah layout.
    function handlePageChange(index: number) {
        currentPageRef.current = index;
    }

    return (
        <div className={`relative shrink-0 ${STAGE_WIDTH}`}>
            {showInlineFlipbook && store ? (
                <Suspense
                    fallback={
                        <div className="aspect-[148/210] w-full animate-pulse rounded bg-oxford-navy-50" />
                    }
                >
                    <BookFlipbook
                        key={session.id}
                        store={store}
                        title={title}
                        frontCover={frontCover}
                        fallbackCover={fallbackCover}
                        backCover={backCover}
                        layout="inline"
                        initialPage={session.startPage}
                        openOnMount={session.animateOpen}
                        onPageChange={handlePageChange}
                        onExpand={() => switchLayout(true)}
                        onClose={closeFlipbook}
                    />
                </Suspense>
            ) : (
                <div
                    ref={coverRef}
                    role={canPreview ? 'button' : undefined}
                    tabIndex={canPreview ? 0 : undefined}
                    aria-label={
                        canPreview ? `Buka preview buku ${title}` : undefined
                    }
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onClick={canPreview ? handleClick : undefined}
                    onKeyDown={handleKeyDown}
                    style={
                        drag.active
                            ? {
                                  transform: `perspective(1100px) rotateY(${angle}deg)`,
                                  transformOrigin: 'left center',
                                  transition: 'none',
                              }
                            : undefined
                    }
                    className={`group relative touch-pan-y select-none rounded outline-none transition-[scale,transform] duration-300 ease-out hover:z-10 hover:scale-[1.08] focus-visible:ring-2 focus-visible:ring-forest-moss-600 focus-visible:ring-offset-4 motion-reduce:transition-none motion-reduce:hover:scale-100 [&_img]:pointer-events-none ${
                        canPreview ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                >
                    <BookCover
                        src={frontCover}
                        fallbackSrc={fallbackCover}
                        title={title}
                        alt={`Sampul buku ${title}`}
                        className="w-full"
                    />

                    {discount > 0 && (
                        <span className="absolute -right-3 -top-3 rounded-full bg-forest-moss-600 px-3 py-1.5 text-xs font-semibold leading-none text-white shadow-md">
                            Diskon {discount}%
                        </span>
                    )}

                    {canPreview && !isLoading && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-full bg-oxford-navy-900/75 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                            <RiArrowLeftRightLine className="size-4" />
                            Geser untuk baca preview
                        </span>
                    )}

                    {isLoading && (
                        <span
                            role="status"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded bg-oxford-navy-900/45 text-xs font-medium text-white backdrop-blur-[1px]"
                        >
                            <span className="size-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Menyiapkan preview…
                        </span>
                    )}
                </div>
            )}

            {mode === 'flipbook' && preview.status === 'error' && (
                <div
                    role="alert"
                    className="mt-4 flex flex-col items-center gap-2 text-center text-sm text-oxford-navy-900/70"
                >
                    <p>Preview belum bisa dimuat.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {previewFileUrl && (
                            <a
                                href={previewFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={chipClass}
                            >
                                Buka PDF
                                <RiExternalLinkLine
                                    aria-hidden
                                    className="size-4"
                                />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={closeFlipbook}
                            className={chipClass}
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {mode === 'flipbook' && dialogOpen && store && (
                <FlipbookDialog
                    title={title}
                    onClose={() => switchLayout(false)}
                >
                    <Suspense fallback={null}>
                        <BookFlipbook
                            key={session.id}
                            store={store}
                            title={title}
                            frontCover={frontCover}
                            fallbackCover={fallbackCover}
                            backCover={backCover}
                            layout="dialog"
                            initialPage={session.startPage}
                            onPageChange={handlePageChange}
                            onClose={() => switchLayout(false)}
                        />
                    </Suspense>
                </FlipbookDialog>
            )}
        </div>
    );
}
