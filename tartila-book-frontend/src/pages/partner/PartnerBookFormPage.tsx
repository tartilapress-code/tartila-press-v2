import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import {
    BookFiles,
    BookHistory,
    StatusBadge,
} from '@/components/partner/PartnerParts';
import * as api from '@/data/partnerApi';
import { useAuth } from '@/context/auth';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { readPdfPageCount } from '@/lib/pdfPageCount';

const field =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500 disabled:bg-oxford-navy-900/5';

const LANGUAGES: [string, string][] = [
    ['id', 'Indonesia'],
    ['en', 'Inggris'],
    ['ms', 'Melayu'],
    ['ar', 'Arab'],
    ['jv', 'Jawa'],
    ['su', 'Sunda'],
    ['zh', 'Mandarin'],
    ['ja', 'Jepang'],
    ['ko', 'Korea'],
    ['de', 'Jerman'],
    ['fr', 'Prancis'],
];

const AGE_OPTIONS = [
    ['all', 'Semua umur'],
    ['7', '7+'],
    ['13', '13+'],
    ['17', '17+'],
    ['21', '21+'],
] as const;

type Draft = {
    title: string;
    description: string;
    about: string;
    front_cover: string;
    pustaka: 'fiksi' | 'non_fiksi';
    education_field_id: string;
    category_id: string;
    genre_id: string;
    age_limit: string;
    language: string;
    price: string;
    access_days: string;
};

const EMPTY: Draft = {
    title: '',
    description: '',
    about: '',
    front_cover: '',
    pustaka: 'non_fiksi',
    education_field_id: '',
    category_id: '',
    genre_id: '',
    age_limit: 'all',
    language: 'id',
    price: '',
    access_days: '',
};

const toDraft = (book: api.PartnerBook): Draft => ({
    title: book.title,
    description: book.description ?? '',
    about: book.about ?? '',
    front_cover: book.front_cover ?? '',
    pustaka: book.pustaka ?? 'non_fiksi',
    education_field_id: book.education_field_id
        ? String(book.education_field_id)
        : '',
    category_id: book.category_id ? String(book.category_id) : '',
    genre_id: book.genre_id ? String(book.genre_id) : '',
    age_limit: book.age_limit ?? 'all',
    language: book.language ?? 'id',
    price: book.price === null ? '' : String(book.price),
    access_days: book.access_days === null ? '' : String(book.access_days),
});

const toId = (value: string): number | null => (value ? Number(value) : null);
const toNumber = (value: string): number | null =>
    value.trim() === '' ? null : Number(value);

/** Pencarian penulis: wajib akun terdaftar supaya penulis bisa melihat royalti-nya. */
function AuthorPicker({
    authors,
    onChange,
    disabled,
}: {
    authors: { id: number; name: string }[];
    onChange: (authors: { id: number; name: string }[]) => void;
    disabled: boolean;
}) {
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        if (query.trim().length < 2) {
            return;
        }

        const timer = window.setTimeout(() => {
            api.searchUsers(query.trim())
                .then((response) => setResults(response.data))
                .catch(() => setResults([]));
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query]);

    const visible = query.trim().length >= 2 ? results : [];

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-oxford-navy-900/65">
                Cari akun penulis yang sudah terdaftar di Tartila Press /
                Tartila Book. Penulis wajib punya akun agar bisa melihat jumlah
                royalti dan bagi hasilnya. Urutan = urutan nama penulis.
            </p>
            {!disabled && (
                <div className="relative">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari nama akun penulis..."
                        aria-label="Cari akun penulis"
                        className={field}
                    />
                    {visible.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-forest-moss-200">
                            {visible.map((result) => (
                                <button
                                    type="button"
                                    key={result.id}
                                    onClick={() => {
                                        if (
                                            !authors.some(
                                                (a) => a.id === result.id
                                            )
                                        ) {
                                            onChange([...authors, result]);
                                        }
                                        setQuery('');
                                        setResults([]);
                                    }}
                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-forest-moss-50"
                                >
                                    {result.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <ul className="flex flex-col gap-1">
                {authors.map((author, index) => (
                    <li
                        key={author.id}
                        className="flex items-center justify-between rounded bg-forest-moss-50 px-3 py-1.5 text-sm ring-1 ring-forest-moss-100"
                    >
                        <span>
                            {index + 1}. {author.name}
                        </span>
                        {!disabled && (
                            <button
                                type="button"
                                className="text-red-600 hover:underline"
                                onClick={() =>
                                    onChange(
                                        authors.filter(
                                            (a) => a.id !== author.id
                                        )
                                    )
                                }
                            >
                                Hapus
                            </button>
                        )}
                    </li>
                ))}
                {authors.length === 0 && (
                    <li className="text-sm text-amber-800">
                        Belum ada penulis.
                    </li>
                )}
            </ul>
        </div>
    );
}

function FileUpload({
    label,
    accept,
    disabled,
    withPercent,
    onUpload,
}: {
    label: string;
    accept: string;
    disabled: boolean;
    withPercent?: boolean;
    onUpload: (file: File, percent: string) => Promise<void>;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [percent, setPercent] = useState<string>('');
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [inputKey, setInputKey] = useState<number>(0);

    async function upload() {
        if (!file) return;
        setBusy(true);
        setError('');

        try {
            await onUpload(file, percent);
            setFile(null);
            setInputKey((key) => key + 1);
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setBusy(false);
        }
    }

    if (disabled) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-oxford-navy-900">
                {label}
                <input
                    key={inputKey}
                    type="file"
                    accept={accept}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-64 text-xs"
                />
            </label>
            {withPercent && (
                <label className="flex flex-col gap-1 text-xs font-medium text-oxford-navy-900">
                    Kemiripan (%)
                    <input
                        type="number"
                        min={0}
                        max={19.99}
                        step="0.01"
                        value={percent}
                        onChange={(e) => setPercent(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-oxford-navy-900/15 px-2 text-sm"
                    />
                </label>
            )}
            <Button
                type="button"
                variant="outline2"
                className="h-9 py-0"
                disabled={!file || busy}
                onClick={upload}
            >
                {busy ? 'Mengunggah...' : 'Unggah'}
            </Button>
            {error && (
                <p className="basis-full text-xs text-red-600">{error}</p>
            )}
        </div>
    );
}

function FormBody({
    book,
    onChanged,
}: {
    book: api.PartnerBook | null;
    onChanged: (book: api.PartnerBook, created?: boolean) => void;
}) {
    const terms = useLoad(useCallback(() => api.terms(), []));
    const [draft, setDraft] = useState<Draft>(book ? toDraft(book) : EMPTY);
    const [authors, setAuthors] = useState<{ id: number; name: string }[]>(
        book?.authors ?? []
    );
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [coverBusy, setCoverBusy] = useState<boolean>(false);

    const locked = book !== null && !book.editable;
    const all = terms.data?.data ?? [];
    const of = (type: api.PartnerTerm['type']) =>
        all.filter((term) => term.type === type);
    const categories = of('category').filter(
        (term) => !term.pustaka || term.pustaka === draft.pustaka
    );
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft((prev) => ({ ...prev, [key]: value }));

    async function run(task: () => Promise<string | void>) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const done = await task();
            if (done) setMessage(done);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    const payload = (): api.PartnerBookInput => ({
        title: draft.title,
        description: draft.description || null,
        about: draft.about || null,
        front_cover: draft.front_cover || null,
        author_ids: authors.map((author) => author.id),
        pustaka: draft.pustaka,
        education_field_id:
            draft.pustaka === 'non_fiksi'
                ? toId(draft.education_field_id)
                : null,
        category_id: toId(draft.category_id),
        genre_id: draft.pustaka === 'fiksi' ? toId(draft.genre_id) : null,
        age_limit: draft.pustaka === 'fiksi' ? draft.age_limit : 'all',
        language: draft.language,
        price: toNumber(draft.price),
        access_days: toNumber(draft.access_days),
    });

    async function save(event: FormEvent) {
        event.preventDefault();

        await run(async () => {
            if (!book) {
                const response = await api.createBook(payload());
                onChanged(response.data, true);

                return;
            }

            const response = await api.updateBook(book.id, payload());
            onChanged(response.data);

            return response.message;
        });
    }

    async function chooseCover(file: File | null) {
        if (!file) return;
        setCoverBusy(true);
        setMessage('');

        try {
            set('front_cover', await api.uploadImage(file));
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setCoverBusy(false);
        }
    }

    if (!terms.data) {
        return terms.error ? (
            <p className="text-red-600">{terms.error}</p>
        ) : (
            <p className="text-oxford-navy-900/70">Memuat pilihan...</p>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {book?.status === 'rejected' && book.note && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
                    <p className="font-semibold">
                        Ditolak admin — perbaiki lalu ajukan ulang
                    </p>
                    <p className="mt-1 whitespace-pre-line">{book.note}</p>
                </div>
            )}
            {book?.status === 'submitted' && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                    Ebook sedang ditinjau admin. Data tidak bisa diubah selama
                    diajukan; tarik kembali bila perlu direvisi.
                </p>
            )}
            {book?.status === 'approved' && (
                <p className="rounded-xl bg-forest-moss-50 p-4 text-sm text-forest-moss-900 ring-1 ring-forest-moss-200">
                    Ebook disetujui dan tampil di katalog. Untuk mengubah data
                    atau berkas, tarik kembali ke draf (ebook hilang dari
                    katalog sampai disetujui ulang).
                </p>
            )}

            <form onSubmit={save} className="flex flex-col gap-5">
                <fieldset
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    disabled={locked}
                >
                    <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                        1. Data buku
                    </legend>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900 sm:col-span-2">
                        Judul buku
                        <input
                            className={field}
                            value={draft.title}
                            onChange={(e) => set('title', e.target.value)}
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900 sm:col-span-2">
                        Deskripsi singkat
                        <textarea
                            rows={4}
                            className="rounded-lg border border-oxford-navy-900/15 p-3 text-sm font-normal outline-none focus:border-forest-moss-500"
                            value={draft.description}
                            onChange={(e) => set('description', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900 sm:col-span-2">
                        Tentang buku (opsional)
                        <textarea
                            rows={3}
                            className="rounded-lg border border-oxford-navy-900/15 p-3 text-sm font-normal outline-none focus:border-forest-moss-500"
                            value={draft.about}
                            onChange={(e) => set('about', e.target.value)}
                        />
                    </label>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <span className="text-sm font-medium text-oxford-navy-900">
                            Sampul depan
                        </span>
                        <div className="flex items-center gap-3">
                            <BookCover
                                src={draft.front_cover || null}
                                title={draft.title || 'Sampul'}
                                alt=""
                                className="w-16 shrink-0"
                            />
                            {!locked && (
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    disabled={coverBusy}
                                    onChange={(e) =>
                                        chooseCover(e.target.files?.[0] ?? null)
                                    }
                                    className="text-xs"
                                    aria-label="Unggah sampul"
                                />
                            )}
                            {coverBusy && (
                                <span className="text-xs">Mengunggah...</span>
                            )}
                        </div>
                    </div>
                </fieldset>

                <fieldset className="flex flex-col gap-2" disabled={locked}>
                    <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                        2. Penulis
                    </legend>
                    <AuthorPicker
                        authors={authors}
                        onChange={setAuthors}
                        disabled={locked}
                    />
                </fieldset>

                <fieldset
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    disabled={locked}
                >
                    <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                        3. Klasifikasi & harga
                    </legend>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Jenis pustaka
                        <select
                            className={field}
                            value={draft.pustaka}
                            onChange={(e) =>
                                setDraft((prev) => ({
                                    ...prev,
                                    pustaka: e.target.value as Draft['pustaka'],
                                    category_id: '',
                                }))
                            }
                        >
                            <option value="non_fiksi">Non fiksi</option>
                            <option value="fiksi">Fiksi</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Bahasa
                        <select
                            className={field}
                            value={draft.language}
                            onChange={(e) => set('language', e.target.value)}
                        >
                            {LANGUAGES.map(([code, label]) => (
                                <option key={code} value={code}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {draft.pustaka === 'non_fiksi' && (
                        <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                            Bidang pendidikan
                            <select
                                className={field}
                                value={draft.education_field_id}
                                onChange={(e) =>
                                    set('education_field_id', e.target.value)
                                }
                            >
                                <option value="">— belum dipilih —</option>
                                {of('education_field').map((term) => (
                                    <option key={term.id} value={term.id}>
                                        {term.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Kategori buku
                        <select
                            className={field}
                            value={draft.category_id}
                            onChange={(e) => set('category_id', e.target.value)}
                        >
                            <option value="">— belum dipilih —</option>
                            {categories.map((term) => (
                                <option key={term.id} value={term.id}>
                                    {term.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {draft.pustaka === 'fiksi' && (
                        <>
                            <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                                Genre
                                <select
                                    className={field}
                                    value={draft.genre_id}
                                    onChange={(e) =>
                                        set('genre_id', e.target.value)
                                    }
                                >
                                    <option value="">— belum dipilih —</option>
                                    {of('genre').map((term) => (
                                        <option key={term.id} value={term.id}>
                                            {term.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                                Batas usia
                                <select
                                    className={field}
                                    value={draft.age_limit}
                                    onChange={(e) =>
                                        set('age_limit', e.target.value)
                                    }
                                >
                                    {AGE_OPTIONS.map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </>
                    )}
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Harga beli satuan (Rp) — kosong = tidak dijual satuan
                        <input
                            type="number"
                            min={0}
                            className={field}
                            value={draft.price}
                            onChange={(e) => set('price', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Batas waktu akses (hari) — kosong = selamanya
                        <input
                            type="number"
                            min={1}
                            className={field}
                            value={draft.access_days}
                            onChange={(e) => set('access_days', e.target.value)}
                        />
                    </label>
                    <p className="text-xs text-oxford-navy-900/60 sm:col-span-2">
                        Bagi hasil: pembelian ebook Tartila 20% • mitra 30% •
                        penulis 50%. Langganan (menurut jumlah bacaan): Tartila
                        10% • mitra 15% • penulis 75%.
                    </p>
                </fieldset>

                {message && (
                    <p
                        role="status"
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}

                {!locked && (
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="submit"
                            disabled={isBusy || authors.length === 0}
                        >
                            {isBusy
                                ? 'Menyimpan...'
                                : book
                                  ? 'Simpan perubahan'
                                  : 'Buat draf'}
                        </Button>
                        <Link to="/mitra">
                            <Button type="button" variant="outline2">
                                Kembali
                            </Button>
                        </Link>
                    </div>
                )}
            </form>

            {book && (
                <>
                    <section className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-oxford-navy-900">
                            4. Ebook & dokumen
                        </h2>
                        <BookFiles
                            book={book}
                            download={(kind) => api.downloadFile(book.id, kind)}
                        />
                        <FileUpload
                            label="Ebook (PDF, maks. 200 MB)"
                            accept="application/pdf,.pdf"
                            disabled={locked}
                            onUpload={async (file) => {
                                const pages = await readPdfPageCount(
                                    file
                                ).catch(() => undefined);
                                const response = await api.uploadEbook(
                                    book.id,
                                    file,
                                    pages
                                );
                                onChanged(response.data);
                            }}
                        />
                        {(
                            Object.keys(
                                api.DOCUMENT_LABEL
                            ) as api.DocumentKind[]
                        ).map((kind) => (
                            <FileUpload
                                key={kind}
                                label={api.DOCUMENT_LABEL[kind]}
                                accept="application/pdf,image/png,image/jpeg,.pdf"
                                disabled={locked}
                                withPercent={kind === 'turnitin'}
                                onUpload={async (file, percent) => {
                                    const response = await api.uploadDocument(
                                        book.id,
                                        kind,
                                        file,
                                        percent
                                    );
                                    onChanged(response.data);
                                }}
                            />
                        ))}
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-oxford-navy-900">
                            Riwayat & catatan admin
                        </h2>
                        <BookHistory book={book} />
                    </section>
                </>
            )}
        </div>
    );
}

export default function PartnerBookFormPage() {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const loader = useCallback(
        () => (bookId ? api.myBook(bookId) : Promise.resolve(null)),
        [bookId]
    );
    const { data, error, reload } = useLoad(loader);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const book = data?.data ?? null;

    if (!user) return null;
    if (bookId && error) return <p className="text-red-600">{error}</p>;
    if (bookId && !book)
        return <p className="text-oxford-navy-900/70">Memuat...</p>;

    async function act(task: () => Promise<{ message: string } | void>) {
        setBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await task();
            reload();
            if (response) setMessage(response.message);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                        {book ? book.title : 'Tambah ebook'}
                    </h1>
                    {book && <StatusBadge status={book.status} />}
                </div>
                {book && (
                    <div className="flex flex-wrap gap-2">
                        {book.editable && (
                            <Button
                                disabled={busy}
                                onClick={() =>
                                    act(() => api.submitBook(book.id))
                                }
                            >
                                {book.status === 'rejected'
                                    ? 'Ajukan ulang'
                                    : 'Ajukan ke admin'}
                            </Button>
                        )}
                        {(book.status === 'submitted' ||
                            book.status === 'approved') && (
                            <Button
                                variant="outline2"
                                disabled={busy}
                                onClick={() =>
                                    act(() => api.reopenBook(book.id))
                                }
                            >
                                Tarik untuk revisi
                            </Button>
                        )}
                        {book.status === 'draft' && (
                            <button
                                type="button"
                                disabled={busy}
                                className="text-sm font-semibold text-red-600 hover:underline"
                                onClick={async () => {
                                    if (
                                        !window.confirm(
                                            'Hapus draf ini beserta berkasnya?'
                                        )
                                    )
                                        return;
                                    await act(() => api.deleteBook(book.id));
                                    navigate('/mitra');
                                }}
                            >
                                Hapus draf
                            </button>
                        )}
                    </div>
                )}
            </div>

            {book && book.editable && book.missing.length > 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                    Belum lengkap untuk diajukan: {book.missing.join(', ')}.
                </p>
            )}
            {message && (
                <p
                    role="status"
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            <FormBody
                key={
                    book
                        ? `${book.id}-${book.status}-${book.reviewed_at}`
                        : 'new'
                }
                book={book}
                onChanged={(saved, created) => {
                    if (created)
                        navigate(`/mitra/buku/${saved.id}`, { replace: true });
                    else reload();
                }}
            />
        </div>
    );
}
