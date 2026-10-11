import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import PillBadge from '@/components/ui/PillBadge';
import { useAuth } from '@/context/auth';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatDate, formatDateTime, formatRupiah } from '@/lib/format';

function Fact({
    label,
    value,
}: {
    label: string;
    value: string | number | null | undefined;
}) {
    if (value === null || value === undefined || value === '') return null;

    return (
        <div className="flex flex-col">
            <dt className="text-xs uppercase tracking-wide text-oxford-navy-900/55">
                {label}
            </dt>
            <dd className="text-[15px] font-medium text-oxford-navy-900">
                {value}
            </dd>
        </div>
    );
}

const ACCESS_TEXT: Record<api.AccessReason, string> = {
    author: 'Anda penulis buku ini — bebas membacanya.',
    subscription: 'Langganan Anda aktif.',
    purchase: 'Anda sudah membeli buku ini.',
    free: 'Buku ini sedang dibuka untuk dibaca gratis.',
    locked: 'Buku ini terkunci.',
};

function Comments({
    bookId,
    canPost,
    myId,
    isAdmin,
    onChanged,
}: {
    bookId: number;
    canPost: boolean;
    myId?: number;
    isAdmin: boolean;
    // Dipanggil setelah komentar ditambah/dihapus (memperbarui angka di halaman).
    onChanged: () => void;
}) {
    const [page, setPage] = useState<number>(1);
    const loader = useCallback(
        () => api.comments(bookId, page),
        [bookId, page]
    );
    const { data, reload, error } = useLoad(loader);
    const [body, setBody] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);

    async function submit(event: FormEvent) {
        event.preventDefault();

        if (!body.trim()) return;

        setIsBusy(true);
        setMessage('');

        try {
            await api.addComment(bookId, body.trim());
            setBody('');
            setPage(1);
            reload();
            onChanged();
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <section aria-labelledby="komentar" className="flex flex-col gap-4">
            <h2
                id="komentar"
                className="font-display text-2xl font-bold text-oxford-navy-700"
            >
                Komentar
            </h2>

            {canPost ? (
                <form onSubmit={submit} className="flex flex-col gap-2">
                    <label htmlFor="komentar-isi" className="sr-only">
                        Tulis komentar
                    </label>
                    <textarea
                        id="komentar-isi"
                        rows={3}
                        maxLength={2000}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Bagikan kesan Anda tentang buku ini"
                        className="w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-[15px] outline-none focus:border-forest-moss-500"
                    />
                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={isBusy || !body.trim()}>
                            {isBusy ? 'Mengirim...' : 'Kirim komentar'}
                        </Button>
                        {message && (
                            <span className="text-sm text-red-600">
                                {message}
                            </span>
                        )}
                    </div>
                </form>
            ) : (
                <p className="text-sm text-oxford-navy-900/70">
                    <Link
                        to={`/masuk?next=${encodeURIComponent(`/buku/${bookId}`)}`}
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Masuk
                    </Link>{' '}
                    untuk berkomentar.
                </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <ul className="flex flex-col gap-3">
                {data?.data.map((comment) => (
                    <li
                        key={comment.id}
                        className="rounded-xl bg-forest-moss-50/70 p-4 ring-1 ring-forest-moss-100"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-oxford-navy-700">
                                {comment.user.name}
                            </p>
                            <p className="text-xs text-oxford-navy-900/55">
                                {formatDateTime(comment.created_at)}
                            </p>
                        </div>
                        <p className="mt-1 whitespace-pre-line break-words text-[15px] text-oxford-navy-900/85">
                            {comment.body}
                        </p>
                        {(isAdmin ||
                            (myId !== undefined &&
                                comment.user.id === myId)) && (
                            <button
                                type="button"
                                onClick={async () => {
                                    await api
                                        .deleteComment(comment.id)
                                        .catch(() => undefined);
                                    reload();
                                    onChanged();
                                }}
                                className="mt-2 text-xs font-semibold text-red-600 hover:cursor-pointer hover:underline"
                            >
                                Hapus
                            </button>
                        )}
                    </li>
                ))}
                {data && data.data.length === 0 && (
                    <li className="text-sm text-oxford-navy-900/60">
                        Belum ada komentar.
                    </li>
                )}
            </ul>

            {data && data.meta.last_page > 1 && (
                <div className="flex items-center gap-3 text-sm">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="font-semibold text-forest-moss-700 hover:cursor-pointer disabled:opacity-40"
                    >
                        ← Lebih baru
                    </button>
                    <span className="text-oxford-navy-900/60">
                        Halaman {page} dari {data.meta.last_page}
                    </span>
                    <button
                        type="button"
                        disabled={page >= data.meta.last_page}
                        onClick={() => setPage(page + 1)}
                        className="font-semibold text-forest-moss-700 hover:cursor-pointer disabled:opacity-40"
                    >
                        Lebih lama →
                    </button>
                </div>
            )}
        </section>
    );
}

export default function BookDetailPage() {
    const { id = '' } = useParams<{ id: string }>();
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const loader = useCallback(() => api.book(id), [id]);
    const { data, error, reload } = useLoad(loader);
    const [message, setMessage] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const book = data?.data ?? null;

    async function toggle(kind: 'like' | 'save') {
        if (!book) return;

        if (!user) {
            navigate(`/masuk?next=${encodeURIComponent(`/buku/${book.id}`)}`);

            return;
        }

        setIsBusy(true);
        setMessage('');

        try {
            const on = kind === 'like' ? !book.me?.liked : !book.me?.saved;
            await (kind === 'like'
                ? api.like(book.id, on)
                : api.save(book.id, on));
            reload();
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    if (error && !book) {
        return (
            <div className="mx-auto max-w-md px-6 py-16 text-center">
                <p className="text-red-600">{error}</p>
                <Link
                    to="/katalog"
                    className="mt-3 inline-block font-semibold text-forest-moss-700 underline"
                >
                    Kembali ke katalog
                </Link>
            </div>
        );
    }

    if (!book) {
        return (
            <p className="px-6 py-16 text-center text-oxford-navy-900/70">
                Memuat buku...
            </p>
        );
    }

    const access = book.me?.access;
    const topic =
        book.pustaka === 'fiksi'
            ? [book.category, book.genre]
            : [book.education_field, book.category];
    const loginNext = `/masuk?next=${encodeURIComponent(`/buku/${book.id}`)}`;

    return (
        <div className="mx-auto flex max-w-[1232px] flex-col gap-10 px-6 py-8 sm:px-10">
            <nav
                aria-label="Navigasi"
                className="text-sm text-oxford-navy-900/60"
            >
                <Link to="/katalog" className="hover:underline">
                    Katalog
                </Link>{' '}
                ›{' '}
                <span className="text-oxford-navy-900/80">
                    {book.book.title}
                </span>
            </nav>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-[18rem_1fr] lg:grid-cols-[20rem_1fr] lg:gap-12">
                <div className="mx-auto w-full max-w-72">
                    <BookCover
                        src={book.book.cover}
                        title={book.book.title}
                        alt={`Sampul ${book.book.title}`}
                        priority
                        className="w-full"
                    />
                </div>

                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap gap-2">
                        <PillBadge label={book.pustaka_label} />
                        {topic.filter(Boolean).map((name) => (
                            <PillBadge key={name} label={name as string} />
                        ))}
                        {book.free_now && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                                Baca gratis sekarang
                            </span>
                        )}
                    </div>

                    <div>
                        <h1 className="font-display text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl">
                            {book.book.title}
                        </h1>
                        <p className="mt-1 text-lg text-oxford-navy-900/70">
                            {book.book.authors}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-oxford-navy-900/75">
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden className="ri-heart-3-line" />
                            {book.likes_count} suka
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden className="ri-bookmark-line" />
                            {book.saves_count} menyimpan
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden className="ri-chat-3-line" />
                            {book.comments_count} komentar
                        </span>
                        <span
                            className="inline-flex items-center gap-1.5"
                            title="Jumlah pembaca terbanyak pada satu halaman"
                        >
                            <i aria-hidden className="ri-eye-line" />
                            {book.top_page_readers} pembaca pada halaman
                            terpopuler
                        </span>
                    </div>

                    {/* Aksi baca / buka kunci */}
                    <div className="card-shadow flex flex-col gap-3 rounded-2xl bg-forest-moss-50/70 p-5 ring-1 ring-forest-moss-100">
                        {access?.allowed ? (
                            <>
                                <p className="text-sm font-medium text-forest-moss-800">
                                    {ACCESS_TEXT[access.reason]}
                                    {access.expires_at &&
                                        access.reason !== 'author' &&
                                        ` Berlaku sampai ${formatDateTime(access.expires_at)}.`}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Link to={`/baca/${book.id}`}>
                                        <Button className="h-12 px-6">
                                            <i
                                                aria-hidden
                                                className="ri-book-open-line mr-2"
                                            />
                                            {book.me?.last_page &&
                                            book.me.last_page > 1
                                                ? `Lanjut baca (hlm ${book.me.last_page})`
                                                : 'Baca sekarang'}
                                        </Button>
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="flex items-center gap-2 text-sm font-medium text-oxford-navy-900">
                                    <i
                                        aria-hidden
                                        className="ri-lock-2-line text-lg text-oxford-navy-700"
                                    />
                                    Buku ini terkunci. Pilih salah satu cara
                                    membukanya:
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Link to={user ? '/langganan' : loginNext}>
                                        <Button className="h-12">
                                            Berlangganan — baca semua buku
                                        </Button>
                                    </Link>
                                    {book.price !== null && book.price > 0 && (
                                        <Link
                                            to={
                                                user
                                                    ? `/beli/buku/${book.id}`
                                                    : loginNext
                                            }
                                        >
                                            <Button
                                                variant="outline"
                                                className="h-12"
                                            >
                                                Beli buku ini —{' '}
                                                {formatRupiah(book.price)}
                                                {book.access_days
                                                    ? ` (${book.access_days} hari)`
                                                    : ' (selamanya)'}
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                                {!user && (
                                    <p className="text-xs text-oxford-navy-900/65">
                                        Masuk dengan akun Tartila Press untuk
                                        membaca atau membeli.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            disabled={isBusy}
                            aria-pressed={Boolean(book.me?.liked)}
                            onClick={() => void toggle('like')}
                            className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 hover:cursor-pointer ${
                                book.me?.liked
                                    ? 'bg-red-50 text-red-700 ring-red-200'
                                    : 'bg-white text-oxford-navy-700 ring-oxford-navy-200 hover:bg-forest-moss-50'
                            }`}
                        >
                            <i
                                aria-hidden
                                className={
                                    book.me?.liked
                                        ? 'ri-heart-3-fill'
                                        : 'ri-heart-3-line'
                                }
                            />
                            {book.me?.liked ? 'Disukai' : 'Suka'}
                        </button>
                        <button
                            type="button"
                            disabled={isBusy}
                            aria-pressed={Boolean(book.me?.saved)}
                            onClick={() => void toggle('save')}
                            className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 hover:cursor-pointer ${
                                book.me?.saved
                                    ? 'bg-forest-moss-100 text-forest-moss-800 ring-forest-moss-300'
                                    : 'bg-white text-oxford-navy-700 ring-oxford-navy-200 hover:bg-forest-moss-50'
                            }`}
                        >
                            <i
                                aria-hidden
                                className={
                                    book.me?.saved
                                        ? 'ri-bookmark-fill'
                                        : 'ri-bookmark-line'
                                }
                            />
                            {book.me?.saved
                                ? 'Tersimpan di rak'
                                : 'Simpan ke rak'}
                        </button>
                    </div>
                    {message && (
                        <p className="text-sm text-red-600">{message}</p>
                    )}

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-forest-moss-100 pt-5 sm:grid-cols-3">
                        <Fact
                            label="Jenis pustaka"
                            value={book.pustaka_label}
                        />
                        <Fact
                            label="Bidang pendidikan"
                            value={book.education_field}
                        />
                        <Fact label="Kategori buku" value={book.category} />
                        <Fact label="Genre" value={book.genre} />
                        <Fact
                            label="Batas usia"
                            value={
                                book.pustaka === 'fiksi' ? book.age_label : null
                            }
                        />
                        <Fact label="Bahasa" value={book.language_label} />
                        <Fact label="Jumlah halaman" value={book.page_count} />
                        <Fact label="ISBN" value={book.book.isbn} />
                        <Fact
                            label="Diperbarui"
                            value={formatDate(book.updated_at)}
                        />
                    </dl>
                </div>
            </div>

            {(book.book.description || book.book.about) && (
                <section
                    aria-labelledby="tentang"
                    className="flex max-w-3xl flex-col gap-3"
                >
                    <h2
                        id="tentang"
                        className="font-display text-2xl font-bold text-oxford-navy-700"
                    >
                        Tentang buku
                    </h2>
                    {book.book.description && (
                        <p className="whitespace-pre-line leading-relaxed text-oxford-navy-900/85">
                            {book.book.description}
                        </p>
                    )}
                    {book.book.about && (
                        <p className="whitespace-pre-line leading-relaxed text-oxford-navy-900/85">
                            {book.book.about}
                        </p>
                    )}
                </section>
            )}

            <div className="max-w-3xl">
                <Comments
                    bookId={book.id}
                    canPost={Boolean(user)}
                    myId={user?.id}
                    isAdmin={isAdmin}
                    onChanged={reload}
                />
            </div>
        </div>
    );
}
