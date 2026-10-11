import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button';
import FlipReader, { type ReaderHandle } from '@/components/reader/FlipReader';
import ScrollReader from '@/components/reader/ScrollReader';
import { useAuth } from '@/context/auth';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { useReadTracker } from '@/hooks/useReadTracker';
import { describeApiError } from '@/lib/apiErrors';
import { apiUrl, getToken } from '@/lib/http';
import { openPdfPageStore, type PdfPageStore } from '@/lib/pdfPages';

type Mode = 'scroll' | 'flip';

const MODE_KEY = 'tartila_book_reader_mode';
const ZOOMS = [0.8, 1, 1.2, 1.4];

function savedMode(): Mode {
    try {
        return localStorage.getItem(MODE_KEY) === 'flip' ? 'flip' : 'scroll';
    } catch {
        return 'scroll';
    }
}

type Opened = { store: PdfPageStore; ratio: number } | { error: string };

/** Layar baca penuh: pilih mode gulir / balik halaman, tandai halaman, lanjut dari terakhir. */
export default function ReaderPage() {
    const { id = '' } = useParams<{ id: string }>();
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();
    const bookId = Number(id);

    const loadBook = useCallback(() => api.book(id), [id]);
    const { data: bookData, error: bookError } = useLoad(loadBook);
    const book = bookData?.data ?? null;
    const allowed = Boolean(book?.me?.access?.allowed);

    const [opened, setOpened] = useState<Opened | null>(null);
    const [mode, setMode] = useState<Mode>(savedMode);
    const [zoom, setZoom] = useState<number>(1);
    const [page, setPage] = useState<number>(1);
    // Halaman terakhir pada tampilan dua halaman (mode balik halaman).
    const [pageEnd, setPageEnd] = useState<number | null>(null);
    const [startPage, setStartPage] = useState<number | null>(null);
    const [panel, setPanel] = useState<boolean>(false);
    const [jump, setJump] = useState<string>('');
    const [bookmarks, setBookmarks] = useState<api.Bookmark[]>([]);
    const [note, setNote] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const handle = useRef<ReaderHandle>(null);

    const visit = useReadTracker(bookId, allowed);

    // Membuka PDF setelah hak baca terbukti.
    useEffect(() => {
        if (!allowed) return;

        let active = true;
        let current: PdfPageStore | null = null;

        void (async () => {
            try {
                const store = await openPdfPageStore(
                    apiUrl(`/reader/books/${bookId}/file`),
                    {
                        Authorization: `Bearer ${getToken() ?? ''}`,
                    }
                );
                const first = await store.doc.getPage(1);
                const view = first.getViewport({ scale: 1 });
                first.cleanup();

                if (!active) {
                    store.dispose();

                    return;
                }

                current = store;
                setStartPage(
                    Math.min(
                        Math.max(book?.me?.last_page ?? 1, 1),
                        store.pageCount
                    )
                );
                setOpened({ store, ratio: view.width / view.height });
            } catch {
                if (active)
                    setOpened({
                        error: 'Berkas buku tidak dapat dibuka. Coba muat ulang halaman ini.',
                    });
            }
        })();

        return () => {
            active = false;
            current?.dispose();
        };
        // last_page hanya dibaca sekali saat membuka buku.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowed, bookId]);

    useEffect(() => {
        if (!allowed) return;

        let active = true;
        api.bookmarks(bookId)
            .then((response) => active && setBookmarks(response.data))
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [allowed, bookId]);

    // Simpan posisi baca setelah berhenti berpindah sebentar.
    useEffect(() => {
        if (!allowed || !opened || 'error' in opened) return;

        const timer = window.setTimeout(() => {
            api.saveProgress(bookId, page).catch(() => undefined);
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [page, allowed, opened, bookId]);

    const onVisible = useCallback(
        (pages: number[]) => {
            if (pages[0]) setPage(pages[0]);
            setPageEnd(pages.length > 1 ? pages[pages.length - 1] : null);
            visit(pages);
        },
        [visit]
    );

    function chooseMode(next: Mode) {
        setMode(next);

        try {
            localStorage.setItem(MODE_KEY, next);
        } catch {
            // Penyimpanan tidak tersedia: pilihan hanya berlaku selama sesi ini.
        }

        // Mode baru dibuka di halaman yang sedang dibaca.
        setStartPage(page);
    }

    const marked = bookmarks.find((item) => item.page === page);

    async function toggleBookmark(noteText?: string) {
        setMessage('');

        try {
            if (marked && noteText === undefined) {
                await api.deleteBookmark(marked.id);
                setBookmarks((list) =>
                    list.filter((item) => item.id !== marked.id)
                );
            } else {
                const response = await api.addBookmark(
                    bookId,
                    page,
                    noteText ?? ''
                );
                setBookmarks((list) =>
                    [
                        ...list.filter((item) => item.page !== page),
                        response.data,
                    ].sort((a, b) => a.page - b.page)
                );
                setNote('');
            }
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    function submitJump(event: FormEvent) {
        event.preventDefault();
        const target = Number(jump);

        if (
            book &&
            Number.isInteger(target) &&
            target >= 1 &&
            target <= book.page_count
        ) {
            handle.current?.goTo(target);
            setJump('');
        }
    }

    if (isLoading) {
        return <p className="p-8 text-oxford-navy-900">Memuat...</p>;
    }

    if (!user) {
        return (
            <Navigate
                to={`/masuk?next=${encodeURIComponent(`/baca/${id}`)}`}
                replace
            />
        );
    }

    if (bookError) {
        return (
            <div className="mx-auto max-w-md p-8 text-center">
                <p className="text-red-600">{bookError}</p>
                <Link
                    to="/katalog"
                    className="mt-3 inline-block text-forest-moss-700 underline"
                >
                    Ke katalog
                </Link>
            </div>
        );
    }

    if (!book) {
        return <p className="p-8 text-oxford-navy-900">Memuat buku...</p>;
    }

    if (!allowed) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
                <i
                    aria-hidden
                    className="ri-lock-2-line text-5xl text-oxford-navy-700"
                />
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Buku ini terkunci
                </h1>
                <p className="text-oxford-navy-900/75">
                    Berlangganan atau beli buku ini untuk membacanya.
                </p>
                <Link to={`/buku/${book.id}`}>
                    <Button>Lihat pilihan akses</Button>
                </Link>
            </div>
        );
    }

    const ready =
        opened && !('error' in opened) && startPage !== null ? opened : null;

    return (
        <div className="flex h-dvh flex-col bg-[#eef0e8]">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-forest-moss-100 bg-white px-3 py-2 sm:px-5">
                <button
                    type="button"
                    onClick={() => navigate(`/buku/${book.id}`)}
                    aria-label="Kembali ke halaman buku"
                    className="inline-flex size-9 items-center justify-center rounded-full text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50"
                >
                    <i aria-hidden className="ri-arrow-left-line text-xl" />
                </button>

                <div className="min-w-0 flex-1">
                    <h1 className="font-display truncate text-base font-bold text-oxford-navy-700">
                        {book.book.title}
                    </h1>
                    <p className="truncate text-xs text-oxford-navy-900/60">
                        {book.book.authors}
                    </p>
                </div>

                <div
                    role="group"
                    aria-label="Mode baca"
                    className="flex rounded-full bg-forest-moss-50 p-0.5 ring-1 ring-forest-moss-200"
                >
                    {(
                        [
                            ['scroll', 'Gulir', 'ri-arrow-up-down-line'],
                            ['flip', 'Balik halaman', 'ri-book-open-line'],
                        ] as const
                    ).map(([value, label, icon]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={mode === value}
                            onClick={() => mode !== value && chooseMode(value)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold hover:cursor-pointer ${
                                mode === value
                                    ? 'bg-oxford-navy-700 text-white'
                                    : 'text-oxford-navy-700 hover:bg-forest-moss-100'
                            }`}
                        >
                            <i aria-hidden className={icon} />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>

                {mode === 'scroll' && (
                    <div
                        role="group"
                        aria-label="Lebar halaman"
                        className="hidden items-center gap-1 md:flex"
                    >
                        {ZOOMS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={zoom === value}
                                onClick={() => setZoom(value)}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold hover:cursor-pointer ${
                                    zoom === value
                                        ? 'bg-forest-moss-600 text-white'
                                        : 'text-oxford-navy-700 hover:bg-forest-moss-50'
                                }`}
                            >
                                {Math.round(value * 100)}%
                            </button>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => void toggleBookmark()}
                    aria-pressed={Boolean(marked)}
                    aria-label={
                        marked
                            ? 'Hapus penanda halaman ini'
                            : 'Tandai halaman ini'
                    }
                    title={
                        marked
                            ? 'Hapus penanda halaman ini'
                            : 'Tandai halaman ini'
                    }
                    className={`inline-flex size-9 items-center justify-center rounded-full hover:cursor-pointer ${
                        marked
                            ? 'bg-amber-100 text-amber-700'
                            : 'text-oxford-navy-700 hover:bg-forest-moss-50'
                    }`}
                >
                    <i
                        aria-hidden
                        className={`${marked ? 'ri-bookmark-fill' : 'ri-bookmark-line'} text-xl`}
                    />
                </button>
                <button
                    type="button"
                    onClick={() => setPanel((value) => !value)}
                    aria-expanded={panel}
                    aria-label="Daftar penanda"
                    title="Daftar penanda"
                    className="relative inline-flex size-9 items-center justify-center rounded-full text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50"
                >
                    <i aria-hidden className="ri-list-check-2 text-xl" />
                    {bookmarks.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 rounded-full bg-oxford-navy-700 px-1 text-[10px] font-bold leading-4 text-white">
                            {bookmarks.length}
                        </span>
                    )}
                </button>
            </header>

            <div className="relative min-h-0 flex-1">
                {!opened && (
                    <p className="p-8 text-center text-oxford-navy-900/70">
                        Membuka buku...
                    </p>
                )}
                {opened && 'error' in opened && (
                    <p className="p-8 text-center text-red-600">
                        {opened.error}
                    </p>
                )}

                {ready && mode === 'scroll' && (
                    <ScrollReader
                        key={`scroll-${startPage}`}
                        doc={ready.store.doc}
                        pageCount={ready.store.pageCount}
                        ratio={ready.ratio}
                        zoom={zoom}
                        initialPage={startPage ?? 1}
                        onVisible={onVisible}
                        handleRef={handle}
                    />
                )}
                {ready && mode === 'flip' && (
                    <div className="h-full px-2 py-3 sm:px-6">
                        <FlipReader
                            key={`flip-${startPage}`}
                            store={ready.store}
                            ratio={ready.ratio}
                            initialPage={startPage ?? 1}
                            onVisible={onVisible}
                            handleRef={handle}
                        />
                    </div>
                )}

                {panel && (
                    <aside
                        aria-label="Penanda halaman"
                        className="card-shadow absolute inset-y-0 right-0 z-20 flex w-full max-w-xs flex-col gap-3 overflow-y-auto bg-white p-4 ring-1 ring-forest-moss-100"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="font-display text-lg font-bold text-oxford-navy-700">
                                Penanda
                            </h2>
                            <button
                                type="button"
                                onClick={() => setPanel(false)}
                                aria-label="Tutup"
                                className="text-oxford-navy-700 hover:cursor-pointer"
                            >
                                <i
                                    aria-hidden
                                    className="ri-close-line text-xl"
                                />
                            </button>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void toggleBookmark(note.trim());
                            }}
                            className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3"
                        >
                            <label
                                className="text-xs font-semibold text-oxford-navy-900/70"
                                htmlFor="bm-note"
                            >
                                Tandai halaman {page} (catatan opsional)
                            </label>
                            <input
                                id="bm-note"
                                value={note}
                                maxLength={255}
                                onChange={(e) => setNote(e.target.value)}
                                className="rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                                placeholder="Mis. kutipan penting"
                            />
                            <Button type="submit" className="self-start">
                                {marked ? 'Perbarui penanda' : 'Tandai'}
                            </Button>
                        </form>

                        {message && (
                            <p className="text-xs text-red-600">{message}</p>
                        )}

                        {bookmarks.length === 0 ? (
                            <p className="text-sm text-oxford-navy-900/65">
                                Belum ada penanda di buku ini.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {bookmarks.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex items-start gap-2 rounded-lg bg-white p-2 ring-1 ring-forest-moss-100"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handle.current?.goTo(item.page);
                                                setPanel(false);
                                            }}
                                            className="min-w-0 flex-1 text-left hover:cursor-pointer"
                                        >
                                            <span className="block text-sm font-semibold text-oxford-navy-700">
                                                Halaman {item.page}
                                            </span>
                                            {item.note && (
                                                <span className="block truncate text-xs text-oxford-navy-900/70">
                                                    {item.note}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Hapus penanda halaman ${item.page}`}
                                            onClick={async () => {
                                                await api
                                                    .deleteBookmark(item.id)
                                                    .catch(() => undefined);
                                                setBookmarks((list) =>
                                                    list.filter(
                                                        (row) =>
                                                            row.id !== item.id
                                                    )
                                                );
                                            }}
                                            className="text-red-600 hover:cursor-pointer"
                                        >
                                            <i
                                                aria-hidden
                                                className="ri-delete-bin-line"
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                )}
            </div>

            <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-forest-moss-100 bg-white px-3 py-2 text-sm">
                <button
                    type="button"
                    onClick={() => handle.current?.prev()}
                    aria-label="Sebelumnya"
                    className="inline-flex size-9 items-center justify-center rounded-full text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50"
                >
                    <i aria-hidden className="ri-arrow-left-s-line text-xl" />
                </button>
                <span
                    aria-live="polite"
                    className="min-w-32 text-center font-medium text-oxford-navy-900/80"
                >
                    Halaman {page}
                    {pageEnd ? `–${pageEnd}` : ''} dari {book.page_count}
                </span>
                <button
                    type="button"
                    onClick={() => handle.current?.next()}
                    aria-label="Berikutnya"
                    className="inline-flex size-9 items-center justify-center rounded-full text-oxford-navy-700 hover:cursor-pointer hover:bg-forest-moss-50"
                >
                    <i aria-hidden className="ri-arrow-right-s-line text-xl" />
                </button>
                <form
                    onSubmit={submitJump}
                    className="flex items-center gap-1.5"
                >
                    <label className="sr-only" htmlFor="jump">
                        Lompat ke halaman
                    </label>
                    <input
                        id="jump"
                        inputMode="numeric"
                        value={jump}
                        onChange={(e) =>
                            setJump(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Ke hlm…"
                        className="h-9 w-24 rounded-full border border-forest-moss-200 bg-forest-moss-50/60 px-3 text-sm outline-none focus:border-forest-moss-500"
                    />
                    <Button
                        type="submit"
                        variant="outline2"
                        className="h-9 py-0"
                    >
                        Pergi
                    </Button>
                </form>
            </footer>
        </div>
    );
}
