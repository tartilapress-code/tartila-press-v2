import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BookCover from '@/components/BookCover';
import Button from '@/components/Button';
import {
    BookFiles,
    BookHistory,
    StatusBadge,
} from '@/components/partner/PartnerParts';
import * as api from '@/data/partnerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatRupiah } from '@/lib/format';

/** Admin: tinjau satu ebook mitra, lalu setujui atau tolak dengan catatan. */
export default function AdminPartnerBookPage() {
    const { bookId } = useParams<{ bookId: string }>();
    const { data, error, reload } = useLoad(
        useCallback(() => api.adminBook(bookId ?? ''), [bookId])
    );
    const [note, setNote] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const book = data?.data;

    if (error) return <p className="text-red-600">{error}</p>;
    if (!book) return <p className="text-oxford-navy-900/70">Memuat...</p>;

    async function act(task: () => Promise<{ message: string }>) {
        setBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await task();
            setMessage(response.message);
            setNote('');
            reload();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusy(false);
        }
    }

    const turnitin = book.documents.turnitin?.percent;

    return (
        <div className="flex flex-col gap-5">
            <Link
                to="/admin/mitra/buku"
                className="text-sm font-semibold text-forest-moss-700 hover:underline"
            >
                ← Antrean ebook mitra
            </Link>

            <div className="flex flex-col gap-4 sm:flex-row">
                <BookCover
                    src={book.front_cover}
                    title={book.title}
                    alt=""
                    className="w-28 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                            {book.title}
                        </h1>
                        <StatusBadge status={book.status} />
                    </div>
                    <p className="text-sm text-oxford-navy-900/70">
                        Mitra: <strong>{book.partner?.company_name}</strong> •
                        Penulis:{' '}
                        {book.authors.map((author) => author.name).join(', ') ||
                            '—'}
                    </p>
                    <p className="text-sm text-oxford-navy-900/70">
                        {book.pustaka === 'fiksi' ? 'Fiksi' : 'Non fiksi'} •
                        bahasa {book.language} •{' '}
                        {book.price
                            ? formatRupiah(book.price)
                            : 'tidak dijual satuan'}
                        {book.access_days ? ` / ${book.access_days} hari` : ''}
                    </p>
                    {book.description && (
                        <p className="mt-2 whitespace-pre-line text-sm text-oxford-navy-900/85">
                            {book.description}
                        </p>
                    )}
                </div>
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-oxford-navy-900">
                    Ebook & dokumen
                </h2>
                <BookFiles
                    book={book}
                    download={(kind) => api.adminDownload(book.id, kind)}
                />
                {turnitin != null && (
                    <p
                        className={`text-sm ${turnitin < 20 ? 'text-forest-moss-800' : 'text-red-700'}`}
                    >
                        Kemiripan Turnitin yang diisi mitra:{' '}
                        <strong>{turnitin}%</strong> (batas: di bawah 20%).
                        Cocokkan dengan berkas hasil Turnitin.
                    </p>
                )}
            </section>

            {book.status === 'submitted' && (
                <section className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/70 p-4">
                    <h2 className="text-sm font-semibold text-oxford-navy-900">
                        Keputusan
                    </h2>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Catatan untuk mitra (wajib bila ditolak)
                        <textarea
                            rows={3}
                            value={note}
                            maxLength={2000}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Mis. surat keaslian belum ditandatangani penulis; hasil Turnitin tidak terbaca."
                            className="rounded-lg border border-oxford-navy-900/15 p-3 text-sm font-normal outline-none focus:border-forest-moss-500"
                        />
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            disabled={busy}
                            onClick={() => act(() => api.adminApprove(book.id))}
                        >
                            Setujui & tampilkan di katalog
                        </Button>
                        <Button
                            variant="outline2"
                            disabled={busy || note.trim().length < 3}
                            onClick={() =>
                                act(() => api.adminReject(book.id, note.trim()))
                            }
                        >
                            Tolak dengan catatan
                        </Button>
                    </div>
                </section>
            )}

            {message && (
                <p
                    role="status"
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-oxford-navy-900">
                    Riwayat
                </h2>
                <BookHistory book={book} />
            </section>
        </div>
    );
}
