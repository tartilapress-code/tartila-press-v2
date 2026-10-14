import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import Pagination from '@/components/Pagination';
import { StatusBadge } from '@/components/partner/PartnerParts';
import * as api from '@/data/partnerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatDateTime } from '@/lib/format';

const FILTERS: [string, string][] = [
    ['submitted', 'Menunggu persetujuan'],
    ['rejected', 'Ditolak'],
    ['approved', 'Disetujui'],
    ['draft', 'Draf mitra'],
    ['', 'Semua'],
];

/** Admin: antrean ebook mitra untuk disetujui atau ditolak (dengan catatan). */
export default function AdminPartnerBooksPage() {
    const [status, setStatus] = useState<string>('submitted');
    const [page, setPage] = useState<number>(1);
    const { data, error, loading } = useLoad(
        useCallback(() => api.adminBooks({ status, page }), [status, page])
    );

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Ebook mitra
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Periksa data buku, ebook, hasil Turnitin, surat keaslian,
                    dan MOU. Setujui agar tampil di katalog, atau tolak dengan
                    catatan perbaikan untuk mitra.
                </p>
            </div>

            <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Filter status"
            >
                {FILTERS.map(([value, label]) => (
                    <button
                        key={value || 'all'}
                        type="button"
                        role="tab"
                        aria-selected={status === value}
                        onClick={() => {
                            setStatus(value);
                            setPage(1);
                        }}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === value ? 'bg-oxford-navy-700 text-white' : 'bg-forest-moss-50 text-oxford-navy-800 hover:bg-forest-moss-100'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

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
                            src={book.front_cover}
                            title={book.title}
                            alt=""
                            className="w-14 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-oxford-navy-700">
                                    {book.title}
                                </p>
                                <StatusBadge status={book.status} />
                            </div>
                            <p className="text-xs text-oxford-navy-900/65">
                                {book.partner?.company_name} • Penulis:{' '}
                                {book.authors
                                    .map((author) => author.name)
                                    .join(', ') || '—'}
                            </p>
                            <p className="text-xs text-oxford-navy-900/65">
                                Turnitin{' '}
                                {book.documents.turnitin?.percent ?? '—'}%
                                {book.submitted_at
                                    ? ` • diajukan ${formatDateTime(book.submitted_at)}`
                                    : ''}
                            </p>
                        </div>
                        <Link to={`/admin/mitra/buku/${book.id}`}>
                            <Button
                                variant={
                                    book.status === 'submitted'
                                        ? 'primary'
                                        : 'outline2'
                                }
                                className="h-10 py-0"
                            >
                                {book.status === 'submitted'
                                    ? 'Tinjau'
                                    : 'Lihat'}
                            </Button>
                        </Link>
                    </div>
                ))}
                {data && data.data.length === 0 && (
                    <p className="rounded-xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/65">
                        Tidak ada ebook di status ini.
                    </p>
                )}
            </div>

            <Pagination meta={data?.meta ?? null} onPageChange={setPage} />
        </div>
    );
}
