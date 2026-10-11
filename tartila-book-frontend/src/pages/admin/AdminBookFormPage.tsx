import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatBytes } from '@/lib/format';

const PRESS_URL = import.meta.env.VITE_PRESS_URL as string;

const field =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const AGE_OPTIONS = [
    ['all', 'Semua umur'],
    ['7', '7+'],
    ['13', '13+'],
    ['17', '17+'],
    ['21', '21+'],
] as const;

const LANGUAGES: [string, string][] = [
    ['id', 'Indonesia'],
    ['en', 'Inggris'],
    ['ms', 'Melayu'],
    ['ar', 'Arab'],
    ['jv', 'Jawa'],
    ['su', 'Sunda'],
    ['min', 'Minang'],
    ['ban', 'Bali'],
    ['zh', 'Mandarin'],
    ['ja', 'Jepang'],
    ['ko', 'Korea'],
    ['hi', 'Hindi'],
    ['th', 'Thailand'],
    ['vi', 'Vietnam'],
    ['fa', 'Persia'],
    ['tr', 'Turki'],
    ['de', 'Jerman'],
    ['fr', 'Prancis'],
    ['nl', 'Belanda'],
    ['es', 'Spanyol'],
    ['pt', 'Portugis'],
    ['it', 'Italia'],
    ['ru', 'Rusia'],
];

type Draft = {
    pustaka: api.Pustaka;
    education_field_id: string;
    category_id: string;
    genre_id: string;
    age_limit: string;
    language: string;
    price: string;
    access_days: string;
    purchase_royalty_percent: string;
    read_fee: string;
    is_published: boolean;
};

const EMPTY: Draft = {
    pustaka: 'non_fiksi',
    education_field_id: '',
    category_id: '',
    genre_id: '',
    age_limit: 'all',
    language: 'id',
    price: '',
    access_days: '',
    purchase_royalty_percent: '',
    read_fee: '',
    is_published: false,
};

const toDraft = (book: api.AdminBook): Draft => ({
    pustaka: book.pustaka,
    education_field_id: book.education_field_id
        ? String(book.education_field_id)
        : '',
    category_id: book.category_id ? String(book.category_id) : '',
    genre_id: book.genre_id ? String(book.genre_id) : '',
    age_limit: book.age_limit,
    language: book.language,
    price: book.price === null ? '' : String(book.price),
    access_days: book.access_days === null ? '' : String(book.access_days),
    purchase_royalty_percent:
        book.purchase_royalty_percent === null
            ? ''
            : String(book.purchase_royalty_percent),
    read_fee: book.read_fee === null ? '' : String(book.read_fee),
    is_published: book.is_published,
});

const number = (value: string): number | null =>
    value.trim() === '' ? null : Number(value);
const id = (value: string): number | null => (value ? Number(value) : null);

function FormBody({
    book,
    onSaved,
}: {
    book: api.AdminBook | null;
    onSaved: (book: api.AdminBook) => void;
}) {
    const terms = useLoad(useCallback(() => api.adminTerms(), []));
    const [draft, setDraft] = useState<Draft>(book ? toDraft(book) : EMPTY);
    const [candidate, setCandidate] = useState<api.Candidate | null>(null);
    const [search, setSearch] = useState<string>('');
    const candidates = useLoad(
        useCallback(
            () => (book ? Promise.resolve(null) : api.adminCandidates(search)),
            [book, search]
        )
    );
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const all = terms.data?.data ?? [];
    const of = (type: api.AdminTerm['type']) =>
        all.filter((term) => term.type === type);
    const categories = of('category').filter(
        (term) => !term.pustaka || term.pustaka === draft.pustaka
    );
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft((prev) => ({ ...prev, [key]: value }));

    const payload = (): api.AdminBookInput => ({
        pustaka: draft.pustaka,
        education_field_id:
            draft.pustaka === 'non_fiksi' ? id(draft.education_field_id) : null,
        category_id: id(draft.category_id),
        genre_id: draft.pustaka === 'fiksi' ? id(draft.genre_id) : null,
        age_limit: draft.pustaka === 'fiksi' ? draft.age_limit : 'all',
        language: draft.language,
        price: number(draft.price),
        access_days: number(draft.access_days),
        purchase_royalty_percent: number(draft.purchase_royalty_percent),
        read_fee: number(draft.read_fee),
        is_published: draft.is_published,
    });

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

    async function save(event: FormEvent) {
        event.preventDefault();

        await run(async () => {
            if (!book) {
                if (!candidate) throw new Error('Pilih buku terbit dulu.');
                const response = await api.adminCreateBook({
                    ...payload(),
                    book_id: candidate.id,
                    is_published: false,
                });
                onSaved(response.data);

                return;
            }

            const response = await api.adminUpdateBook(book.id, payload());
            onSaved(response.data);

            return response.message;
        });
    }

    // Pilihan taksonomi harus sudah ada saat dropdown dirender, supaya nilai
    // yang tersimpan langsung terpilih.
    if (!terms.data) {
        return terms.error ? (
            <p className="text-red-600">{terms.error}</p>
        ) : (
            <p className="text-oxford-navy-900/70">Memuat pilihan...</p>
        );
    }

    return (
        <form onSubmit={save} className="flex flex-col gap-5">
            {!book && (
                <fieldset className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/70 p-4">
                    <legend className="px-1 text-sm font-semibold text-oxford-navy-900">
                        1. Pilih buku terbit Tartila Press
                    </legend>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Cari judul buku"
                        placeholder="Cari judul"
                        className={field}
                    />
                    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                        {candidates.data?.data.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setCandidate(item);
                                    if (item.language)
                                        set('language', item.language);
                                }}
                                aria-pressed={candidate?.id === item.id}
                                className={`flex items-center gap-3 rounded-lg p-2 text-left ring-1 hover:cursor-pointer ${candidate?.id === item.id ? 'bg-white ring-forest-moss-500' : 'bg-white/60 ring-forest-moss-100 hover:bg-white'}`}
                            >
                                <BookCover
                                    src={item.cover}
                                    title={item.title}
                                    alt=""
                                    className="w-10 shrink-0"
                                />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-oxford-navy-700">
                                        {item.title}
                                    </span>
                                    <span className="block truncate text-xs text-oxford-navy-900/65">
                                        {item.authors}
                                    </span>
                                </span>
                            </button>
                        ))}
                        {candidates.data &&
                            candidates.data.data.length === 0 && (
                                <p className="text-sm text-oxford-navy-900/65">
                                    Tidak ada buku yang siap ditambahkan. Hanya
                                    buku terbit yang ebook PDF-nya sudah
                                    diunggah di Tartila Press (Admin &gt; Buku)
                                    yang muncul di sini.
                                </p>
                            )}
                    </div>
                </fieldset>
            )}

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                    {book ? 'Klasifikasi' : '2. Klasifikasi'}
                </legend>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Jenis pustaka
                    <select
                        className={field}
                        value={draft.pustaka}
                        onChange={(e) =>
                            setDraft((prev) => ({
                                ...prev,
                                pustaka: e.target.value as api.Pustaka,
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
                <p className="text-xs text-oxford-navy-900/60 sm:col-span-2">
                    Pilihan bidang, kategori, dan genre diatur di menu{' '}
                    <Link
                        to="/admin/pilihan"
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Taksonomi
                    </Link>
                    .
                </p>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                    {book ? 'Harga beli satuan' : '3. Harga beli satuan'}
                </legend>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Harga (Rp) — kosong = tidak dijual satuan
                    <input
                        type="number"
                        min={0}
                        step="1"
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
                        step="1"
                        className={field}
                        value={draft.access_days}
                        onChange={(e) => set('access_days', e.target.value)}
                    />
                </label>
            </fieldset>

            {book && (
                <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <legend className="mb-2 text-sm font-semibold text-oxford-navy-900">
                        Royalti khusus buku ini (opsional)
                    </legend>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Persen dari pembelian (%)
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className={field}
                            placeholder="Ikut pengaturan umum"
                            value={draft.purchase_royalty_percent}
                            onChange={(e) =>
                                set('purchase_royalty_percent', e.target.value)
                            }
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Biaya per bacaan (Rp)
                        <input
                            type="number"
                            min={0}
                            step="1"
                            className={field}
                            placeholder="Ikut pengaturan umum"
                            value={draft.read_fee}
                            onChange={(e) => set('read_fee', e.target.value)}
                        />
                    </label>
                </fieldset>
            )}

            {book && (
                <label className="flex items-start gap-3 rounded-xl bg-forest-moss-50/70 p-4 text-sm text-oxford-navy-900">
                    <input
                        type="checkbox"
                        className="mt-0.5 size-4"
                        checked={draft.is_published}
                        disabled={!book.has_file}
                        onChange={(e) => set('is_published', e.target.checked)}
                    />
                    <span>
                        <strong>Tampilkan di Tartila Book</strong>
                        <span className="block text-oxford-navy-900/65">
                            {book.has_file
                                ? 'Buku tampil di katalog dan bisa dibaca sesuai aturan akses.'
                                : 'Ebook PDF belum ada di Tartila Press (unggah di sana dulu).'}
                        </span>
                    </span>
                </label>
            )}

            {message && (
                <p
                    role="status"
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            <div className="flex flex-wrap gap-3">
                <Button
                    type="submit"
                    disabled={isBusy || (!book && !candidate)}
                >
                    {isBusy
                        ? 'Menyimpan...'
                        : book
                          ? 'Simpan perubahan'
                          : 'Tambahkan ke Tartila Book'}
                </Button>
                <Link to="/admin">
                    <Button type="button" variant="outline2">
                        Kembali
                    </Button>
                </Link>
            </div>

            {book && (
                <fieldset className="flex flex-col gap-2 rounded-xl bg-forest-moss-50/70 p-4">
                    <legend className="px-1 text-sm font-semibold text-oxford-navy-900">
                        Berkas ebook (dari Tartila Press)
                    </legend>
                    {book.has_file ? (
                        <p className="text-sm text-oxford-navy-900/80">
                            Dipakai: <strong>{book.file_name}</strong> (
                            {formatBytes(book.file_size)}, {book.page_count}{' '}
                            halaman, versi {book.version}). Mengganti ebook di
                            Tartila Press menaikkan versi dan memberi tahu
                            pembaca yang menyimpan buku ini.
                        </p>
                    ) : (
                        <p className="text-sm text-amber-800">
                            Belum ada ebook PDF yang bisa dibaca di Tartila
                            Press.
                        </p>
                    )}
                    <p className="text-xs text-oxford-navy-900/60">
                        Ebook tidak diunggah di sini lagi: unggah sekali di
                        Tartila Press, di{' '}
                        <a
                            href={`${PRESS_URL}/admin/books`}
                            className="font-semibold text-forest-moss-700 underline"
                        >
                            Admin &gt; Buku
                        </a>{' '}
                        (kartu buku &gt; Ebook lengkap, berformat PDF).
                    </p>
                </fieldset>
            )}
        </form>
    );
}

export default function AdminBookFormPage() {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const loader = useCallback(
        () => (bookId ? api.adminBook(bookId) : Promise.resolve(null)),
        [bookId]
    );
    const { data, error, reload } = useLoad(loader);
    const [removing, setRemoving] = useState<boolean>(false);
    const book = data?.data ?? null;

    if (bookId && error) return <p className="text-red-600">{error}</p>;
    if (bookId && !book)
        return <p className="text-oxford-navy-900/70">Memuat...</p>;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    {book ? book.book.title : 'Tambah buku ke Tartila Book'}
                </h1>
                {book && (
                    <button
                        type="button"
                        disabled={removing}
                        onClick={async () => {
                            if (
                                !window.confirm(
                                    'Hapus buku ini dari Tartila Book? Ebook dan hitungan bacanya ikut terhapus.'
                                )
                            )
                                return;
                            setRemoving(true);
                            await api
                                .adminDeleteBook(book.id)
                                .catch(() => undefined);
                            navigate('/admin');
                        }}
                        className="text-sm font-semibold text-red-600 hover:cursor-pointer hover:underline"
                    >
                        Hapus dari Tartila Book
                    </button>
                )}
            </div>
            <FormBody
                key={
                    book ? `${book.id}-${book.version}-${book.has_file}` : 'new'
                }
                book={book}
                onSaved={(saved) => {
                    if (!book)
                        navigate(`/admin/buku/${saved.id}`, { replace: true });
                    else reload();
                }}
            />
        </div>
    );
}
