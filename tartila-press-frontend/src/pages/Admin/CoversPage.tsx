import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { SearchField } from '@/components/ui/FilterControls';
import * as coverApi from '@/data/cover/coverApi';
import { describeApiError } from '@/lib/apiErrors';

type Tab = 'packages' | 'chapters' | 'books';

const TABS: { key: Tab; label: string; hint: string }[] = [
    {
        key: 'packages',
        label: 'Cover Paket',
        hint: 'Tagihan cover: naskah yang hasil editingnya sudah Anda setujui, dan Book Chapter yang naskah gabungannya siap. Unggah 3 pilihan; penulis memilih (voting bila lebih dari satu penulis).',
    },
    {
        key: 'chapters',
        label: 'Cover Book Chapter',
        hint: 'Proyek Book Chapter yang sudah dibuat. Cover awal (satu) boleh diunggah lebih awal dan tampil publik; pada masa tenggat tambahkan 2 pilihan lain. Setelah naskah gabungan di-auto layout, proyek pindah ke Cover Paket.',
    },
    {
        key: 'books',
        label: 'Cover Buku',
        hint: 'Cover buku yang sudah terbit (final). Cover terakhir yang dipakai di buku bisa diganti di sini.',
    },
];

const dateTime = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
});

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

function ProjectRow({ item }: { item: coverApi.CoverListItem }) {
    const urgent = item.status === 'awaiting_upload' && item.stage === 'urgent';

    return (
        <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100">
            <div className="flex min-w-0 items-center gap-3">
                {item.front_cover && (
                    <img
                        src={item.front_cover}
                        alt=""
                        className="h-16 w-12 shrink-0 rounded object-cover ring-1 ring-forest-moss-200"
                    />
                )}
                <div className="min-w-0">
                    <p className="font-semibold text-oxford-navy-900">
                        {item.title}
                        {item.source === 'chapter' && (
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-oxford-navy-800 ring-1 ring-forest-moss-200">
                                Book Chapter
                            </span>
                        )}
                        {urgent && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                                Mendesak
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-oxford-navy-900/70">
                        {coverApi.STATUS_LABEL[item.status]}
                        {item.status === 'awaiting_upload' &&
                            ` • ${item.uploaded}/${item.needed} cover diunggah`}
                        {item.status === 'voting' &&
                            ` • ${item.votes}/${item.authors} penulis sudah memilih`}
                        {item.deadline &&
                            ` • tenggat ${dateTime.format(new Date(item.deadline))}`}
                    </p>
                </div>
            </div>
            <Link to={`/admin/covers/${item.id}`}>
                <Button variant={urgent ? 'primary' : 'outline2'}>
                    Kelola
                </Button>
            </Link>
        </li>
    );
}

function BooksTab({ search }: { search: string }) {
    const [page, setPage] = useState<number>(1);
    const [data, setData] = useState<coverApi.BookCoverItem[] | null>(null);
    const [lastPage, setLastPage] = useState<number>(1);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [message, setMessage] = useState<string>('');
    const [reload, setReload] = useState<number>(0);

    useEffect(() => {
        coverApi
            .books({ page, search })
            .then((response) => {
                setData(response.data);
                setLastPage(response.meta.last_page);
            })
            .catch((error) => setMessage(describeApiError(error)));
    }, [page, search, reload]);

    async function replace(
        book: coverApi.BookCoverItem,
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) return;

        setBusyId(book.id);
        setMessage('');

        try {
            await coverApi.replaceBookCover(book.id, file);
            setMessage(`Cover "${book.title}" diganti.`);
            setReload((value) => value + 1);
        } catch (error) {
            setMessage(describeApiError(error));
        } finally {
            setBusyId(null);
            event.target.value = '';
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {message && (
                <p role="status" className="text-sm text-forest-moss-700">
                    {message}
                </p>
            )}
            {data === null ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : data.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/70">
                    Belum ada buku terbit.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {data.map((book) => (
                        <li
                            key={book.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                {book.front_cover ? (
                                    <img
                                        src={book.front_cover}
                                        alt=""
                                        className="h-20 w-14 shrink-0 rounded object-cover ring-1 ring-forest-moss-200"
                                    />
                                ) : (
                                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-white text-[10px] text-oxford-navy-900/50 ring-1 ring-forest-moss-200">
                                        Belum ada
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-semibold text-oxford-navy-900">
                                        {book.title}
                                    </p>
                                    <p className="text-xs text-oxford-navy-900/70">
                                        {book.authors || '—'}
                                    </p>
                                    {book.published_at && (
                                        <p className="text-xs text-oxford-navy-900/60">
                                            {book.files_purged
                                                ? 'Berkas cover/revisi sudah dihapus; tersisa cover terakhir.'
                                                : book.purge_at
                                                  ? `Berkas cover/revisi dihapus ${dateTime.format(new Date(book.purge_at))}.`
                                                  : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <label
                                className={`cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-semibold text-oxford-navy-800 ring-1 ring-forest-moss-200 hover:bg-forest-moss-50 ${busyId === book.id ? 'opacity-50' : ''}`}
                            >
                                {busyId === book.id
                                    ? 'Mengunggah...'
                                    : 'Ganti cover final'}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    disabled={busyId === book.id}
                                    onChange={(event) => replace(book, event)}
                                />
                            </label>
                        </li>
                    ))}
                </ul>
            )}
            {lastPage > 1 && (
                <div className="flex gap-2">
                    <Button
                        variant="outline2"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <span className="self-center text-sm">
                        Halaman {page}/{lastPage}
                    </span>
                    <Button
                        variant="outline2"
                        disabled={page >= lastPage}
                        onClick={() => setPage(page + 1)}
                    >
                        Berikutnya
                    </Button>
                </div>
            )}
        </div>
    );
}

/** Admin: Cover khusus — Cover Paket, Cover Book Chapter, dan Cover Buku (terbit). */
export default function CoversPage() {
    const [tab, setTab] = useState<Tab>('packages');
    const [search, setSearch] = useState<string>('');
    const [items, setItems] = useState<coverApi.CoverListItem[] | null>(null);
    const [error, setError] = useState<string>('');

    const load = useCallback(() => {
        if (tab === 'books') {
            return;
        }

        const request =
            tab === 'packages'
                ? coverApi.packages(search)
                : coverApi.chapters(search);

        request
            .then((response) => {
                setItems(response.data);
                setError('');
            })
            .catch((failure) => setError(describeApiError(failure)));
    }, [tab, search]);

    useEffect(() => {
        load();
    }, [load]);

    const current = TABS.find((item) => item.key === tab)!;

    return (
        <div className={cardClass}>
            <div>
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    Cover
                </h5>
                <p className="text-sm text-oxford-navy-900/70">
                    {current.hint}
                </p>
            </div>

            <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Jenis cover"
            >
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.key}
                        onClick={() => {
                            setTab(item.key);
                            setItems(null);
                        }}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === item.key ? 'bg-oxford-navy-700 text-white' : 'bg-forest-moss-50 text-oxford-navy-800 hover:bg-forest-moss-100'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Cari judul"
                ariaLabel="Cari judul"
                className="sm:w-72"
            />

            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}

            {tab === 'books' ? (
                <BooksTab search={search} />
            ) : items === null ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/70">
                    {tab === 'packages'
                        ? 'Belum ada tagihan cover.'
                        : 'Belum ada proyek Book Chapter.'}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {items.map((item) => (
                        <ProjectRow key={item.id} item={item} />
                    ))}
                </ul>
            )}
        </div>
    );
}
