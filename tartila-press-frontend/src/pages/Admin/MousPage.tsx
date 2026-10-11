import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '@/components/ui/Pagination';
import * as mouApi from '@/data/mou/mouApi';
import { describeApiError } from '@/lib/apiErrors';
import type { PageMeta } from '@/lib/pagination';

const STATUS_TABS: { value: '' | mouApi.MouStatus; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: 'Menunggu penulis' },
    { value: 'signed', label: 'Menunggu penerbit & meterai' },
    { value: 'completed', label: 'Selesai' },
];

/** Admin: MOU distribusi buku per judul. */
export default function MousPage() {
    const [rows, setRows] = useState<mouApi.AdminMouRow[]>([]);
    const [meta, setMeta] = useState<
        (PageMeta & { counts?: Record<string, number> }) | null
    >(null);
    const [status, setStatus] = useState<'' | mouApi.MouStatus>('');
    const [type, setType] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [query, setQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let active = true;

        mouApi
            .adminList({ page, status, type, search: query })
            .then((response) => {
                if (!active) return;
                setRows(response.data);
                setMeta(response.meta);
            })
            .catch((caught) => {
                if (active) setError(describeApiError(caught));
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [page, status, type, query]);

    const counts = meta?.counts ?? {};

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    MOU Distribusi Buku
                </h5>
                <p className="text-sm text-oxford-navy-900/75">
                    Satu MOU per judul. Setelah semua penulis menandatangani,
                    unduh MOU bertanda tangan & stempel penerbit, bubuhkan
                    meterai, lalu unggah PDF bermeterai agar bisa dibuka penulis
                    di Royalti Saya. Isi utama diatur di{' '}
                    <Link
                        to="/admin/mou-template"
                        className="text-forest-moss-700 underline"
                    >
                        Template MOU
                    </Link>
                    .
                </p>
            </div>

            <div className="flex flex-row flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => {
                            setStatus(tab.value);
                            setPage(1);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold hover:cursor-pointer ${status === tab.value ? 'bg-oxford-navy-700 text-white' : 'bg-forest-moss-50 text-oxford-navy-800 ring-1 ring-forest-moss-200'}`}
                    >
                        {tab.label} ({counts[tab.value || 'all'] ?? 0})
                    </button>
                ))}
            </div>

            <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    setQuery(search.trim());
                    setPage(1);
                }}
            >
                <input
                    className="w-full rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                    placeholder="Cari judul buku"
                    aria-label="Cari judul buku"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                    aria-label="Kategori paket"
                    value={type}
                    onChange={(e) => {
                        setType(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">Semua kategori</option>
                    <option value="regular">Paket biasa</option>
                    <option value="chapter">Book Chapter</option>
                </select>
                <button
                    type="submit"
                    className="rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:cursor-pointer hover:bg-oxford-navy-600"
                >
                    Cari
                </button>
            </form>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {isLoading ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/60">
                    Belum ada MOU. MOU dibuat otomatis saat naskah selesai
                    (paket biasa) atau naskah gabungan masuk review akhir (Book
                    Chapter).
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((row) => (
                        <div
                            key={row.id}
                            className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex flex-row flex-wrap items-center gap-2">
                                    <p className="font-semibold text-oxford-navy-900">
                                        {row.title}
                                    </p>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${mouApi.STATUS_CLASS[row.status]}`}
                                    >
                                        {row.status_label}
                                    </span>
                                    {row.customized && (
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-oxford-navy-800 ring-1 ring-oxford-navy-900/15">
                                            Disesuaikan
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-oxford-navy-900/65">
                                    {row.number} •{' '}
                                    {row.type === 'chapter'
                                        ? 'Book Chapter'
                                        : 'Paket biasa'}{' '}
                                    • {row.authors.join(', ')}
                                </p>
                                <p className="text-xs text-oxford-navy-900/65">
                                    {row.signed_count} dari{' '}
                                    {row.signatories_count} penulis sudah tanda
                                    tangan
                                    {row.has_final && ' • PDF bermeterai ada'}
                                </p>
                            </div>
                            <Link
                                to={`/admin/mou/${row.id}`}
                                className="shrink-0 self-start rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600 sm:self-center"
                            >
                                Kelola
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <Pagination meta={meta} onPageChange={setPage} />
        </div>
    );
}
