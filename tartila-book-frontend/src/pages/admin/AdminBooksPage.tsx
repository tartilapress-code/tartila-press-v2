import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import Pagination from '@/components/Pagination';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatBytes, formatRupiah } from '@/lib/format';

/** Daftar buku di Tartila Book (admin). */
export default function AdminBooksPage() {
    const [search, setSearch] = useState<string>('');
    const [query, setQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const { data, error, loading } = useLoad(
        useCallback(
            () => api.adminBooks({ page, search: query }),
            [page, query]
        )
    );

    function submit(event: FormEvent) {
        event.preventDefault();
        setQuery(search.trim());
        setPage(1);
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                        Buku & ebook
                    </h1>
                    <p className="text-sm text-oxford-navy-900/65">
                        Pilih buku terbit Tartila Press, unggah ebook (PDF),
                        atur klasifikasi dan harga.
                    </p>
                </div>
                <Link to="/admin/buku/baru">
                    <Button>Tambah buku</Button>
                </Link>
            </div>

            <form onSubmit={submit} role="search" className="flex gap-2">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Cari judul"
                    placeholder="Cari judul buku"
                    className="h-10 w-full max-w-sm rounded-lg border border-oxford-navy-900/15 px-3 text-sm"
                />
                <Button type="submit" variant="outline2" className="h-10 py-0">
                    Cari
                </Button>
            </form>

            {error && <p className="text-red-600">{error}</p>}

            <div
                className={`flex flex-col gap-3 ${loading ? 'opacity-60' : ''}`}
            >
                {data?.data.map((book) => (
                    <div
                        key={book.id}
                        className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/60 p-3 ring-1 ring-forest-moss-100 sm:flex-row sm:items-center"
                    >
                        <BookCover
                            src={book.book.cover}
                            title={book.book.title}
                            alt=""
                            className="w-16 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-oxford-navy-700">
                                    {book.book.title}
                                </p>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${book.is_published ? 'bg-forest-moss-100 text-forest-moss-800' : 'bg-amber-100 text-amber-900'}`}
                                >
                                    {book.is_published
                                        ? 'Terbit di Tartila Book'
                                        : 'Draf'}
                                </span>
                                {!book.has_file && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                        Belum ada ebook
                                    </span>
                                )}
                                {!book.book_active && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                        Buku nonaktif di Press
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-oxford-navy-900/65">
                                {book.pustaka_label}
                                {book.category
                                    ? ` • ${book.category}`
                                    : ''} • {book.page_count} hlm
                                {book.has_file
                                    ? ` • ${book.file_name} (${formatBytes(book.file_size)}) v${book.version}`
                                    : ''}
                            </p>
                            <p className="text-xs text-oxford-navy-900/65">
                                {book.price
                                    ? `${formatRupiah(book.price)}${book.access_days ? ` / ${book.access_days} hari` : ' selamanya'}`
                                    : 'Tidak dijual satuan'}
                                {' • '}
                                {book.read_events.toLocaleString('id-ID')}{' '}
                                bacaan • {book.likes_count} suka •{' '}
                                {book.saves_count} simpan
                            </p>
                        </div>
                        <Link to={`/admin/buku/${book.id}`}>
                            <Button variant="outline2" className="h-10 py-0">
                                Kelola
                            </Button>
                        </Link>
                    </div>
                ))}
                {data && data.data.length === 0 && (
                    <p className="rounded-xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/65">
                        Belum ada buku. Klik "Tambah buku".
                    </p>
                )}
            </div>

            <Pagination meta={data?.meta ?? null} onPageChange={setPage} />
        </div>
    );
}
