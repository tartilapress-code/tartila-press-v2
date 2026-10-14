import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import { StatusBadge } from '@/components/partner/PartnerParts';
import * as api from '@/data/partnerApi';
import { useLoad } from '@/hooks/useLoad';

/** Dashboard mitra: daftar ebook milik mitra beserta status persetujuannya. */
export default function PartnerBooksPage() {
    const { data, error, loading } = useLoad(
        useCallback(() => api.myBooks(), [])
    );

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                        Ebook {data?.meta.company_name ?? 'mitra'}
                    </h1>
                    <p className="text-sm text-oxford-navy-900/65">
                        Unggah data buku, ebook (PDF), hasil Turnitin, surat
                        keaslian, dan MOU. Ebook baru tampil di katalog setelah
                        disetujui admin.
                    </p>
                </div>
                <Link to="/mitra/buku/baru">
                    <Button>Tambah ebook</Button>
                </Link>
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
                            className="w-16 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-oxford-navy-700">
                                    {book.title}
                                </p>
                                <StatusBadge status={book.status} />
                                {book.is_listed && (
                                    <span className="rounded-full bg-forest-moss-100 px-2 py-0.5 text-[11px] font-semibold text-forest-moss-800">
                                        Tampil di katalog
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-oxford-navy-900/65">
                                Penulis:{' '}
                                {book.authors
                                    .map((author) => author.name)
                                    .join(', ') || '—'}
                            </p>
                            {book.status === 'rejected' && book.note && (
                                <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                                    Catatan admin: {book.note}
                                </p>
                            )}
                            {book.status === 'draft' &&
                                book.missing.length > 0 && (
                                    <p className="mt-1 text-xs text-amber-800">
                                        Belum lengkap: {book.missing.join(', ')}
                                        .
                                    </p>
                                )}
                        </div>
                        <Link to={`/mitra/buku/${book.id}`}>
                            <Button variant="outline2" className="h-10 py-0">
                                {book.editable ? 'Lengkapi / ubah' : 'Lihat'}
                            </Button>
                        </Link>
                    </div>
                ))}
                {data && data.data.length === 0 && (
                    <p className="rounded-xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/65">
                        Belum ada ebook. Klik &quot;Tambah ebook&quot;.
                    </p>
                )}
            </div>
        </div>
    );
}
