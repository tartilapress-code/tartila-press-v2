import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    RiAwardLine,
    RiBookOpenLine,
    RiDownload2Line,
    RiShieldCheckLine,
} from '@remixicon/react';
import BookCover from '@/components/book/catalog/BookCover';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as publishedBookApi from '@/data/publishedBook/publishedBookApi';
import type { MyPublishedBook } from '@/data/publishedBook/publishedBookApi';
import * as hkiApi from '@/data/hki/hkiApi';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import { DEFAULT_CHAPTER_COVER } from '@/lib/bookChapterPublic';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const hkiTone: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    submitted: 'bg-sky-50 text-sky-800 ring-sky-200',
    registered: 'bg-forest-moss-50 text-forest-moss-800 ring-forest-moss-200',
};

const actionClass =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60';
const primaryAction = `${actionClass} bg-oxford-navy-700 text-white hover:bg-oxford-navy-600`;
const secondaryAction = `${actionClass} bg-forest-moss-100 text-forest-moss-800 hover:bg-forest-moss-200`;

/**
 * "Buku Terbit" penulis: buku yang sudah terbit, ebook lengkap (diunggah
 * admin), sertifikat HKI bila paketnya memuat HKI, dan sertifikat penulis.
 */
export default function MyPublishedBooksPage() {
    const [books, setBooks] = useState<MyPublishedBook[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ url: string; title: string } | null>(
        null
    );
    const certificate = useCertificateDownload();

    useEffect(() => {
        publishedBookApi
            .mine()
            .then((response) => setBooks(response.data))
            .catch((failure) =>
                setError(describeApiError(failure, 'Buku tidak bisa dimuat.'))
            )
            .finally(() => setIsLoading(false));
    }, []);

    async function run(key: string, task: () => Promise<void>) {
        setBusyKey(key);
        setError('');

        try {
            await task();
        } catch (failure) {
            setError(describeApiError(failure));
        } finally {
            setBusyKey(null);
        }
    }

    function downloadEbook(book: MyPublishedBook) {
        return run(`ebook-${book.id}`, async () => {
            const { blob, filename } = await publishedBookApi.ebookFile(
                book.id
            );
            saveBlob(blob, filename ?? `${book.slug}.pdf`);
        });
    }

    function openHki(book: MyPublishedBook, recordId: number, inline: boolean) {
        return run(`hki-${book.id}`, async () => {
            const { blob, filename } = await hkiApi.myCertificateFile(
                recordId,
                inline
            );

            if (inline && blob.type === 'application/pdf') {
                setViewer({
                    url: URL.createObjectURL(blob),
                    title: `Sertifikat HKI — ${book.title}`,
                });
            } else {
                saveBlob(blob, filename ?? 'sertifikat-hki');
            }
        });
    }

    function closeViewer() {
        if (viewer) {
            URL.revokeObjectURL(viewer.url);
        }

        setViewer(null);
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Buku Terbit
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Buku Anda yang sudah terbit: unduh ebook lengkap, sertifikat
                    HKI, dan sertifikat penulis.
                </p>
            </div>

            {(error || certificate.error) && (
                <p role="alert" className="text-red-600 text-sm">
                    {error || certificate.error}
                </p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : books.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada buku terbit. Buku muncul di sini setelah naskah
                    Anda diterbitkan admin.
                </p>
            ) : (
                <ul className="flex flex-col gap-4">
                    {books.map((book) => (
                        <li
                            key={book.id}
                            className="flex flex-col gap-4 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100 sm:flex-row"
                        >
                            <Link
                                to={`/buku/${book.slug}`}
                                className="w-24 shrink-0 self-start"
                                aria-label={`Buka halaman buku ${book.title}`}
                            >
                                <BookCover
                                    src={book.front_cover}
                                    fallbackSrc={
                                        book.is_book_chapter
                                            ? DEFAULT_CHAPTER_COVER
                                            : undefined
                                    }
                                    title={book.title}
                                    alt=""
                                />
                            </Link>

                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <Link
                                        to={`/buku/${book.slug}`}
                                        className="font-display text-lg font-bold text-oxford-navy-800 hover:text-oxford-navy-600"
                                    >
                                        {book.title}
                                    </Link>
                                    <p className="text-sm text-oxford-navy-900/70">
                                        {book.authors}
                                    </p>
                                    <p className="text-xs text-oxford-navy-900/65">
                                        {[
                                            book.isbn && `ISBN ${book.isbn}`,
                                            book.published_at &&
                                                `Terbit ${dateFormatter.format(new Date(book.published_at))}`,
                                            book.category,
                                            book.is_book_chapter &&
                                                'Book Chapter',
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    {/* Ebook lengkap */}
                                    <section className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
                                        <h6 className="flex items-center gap-1.5 text-sm font-semibold text-oxford-navy-800">
                                            <RiBookOpenLine
                                                size={16}
                                                aria-hidden
                                            />
                                            Ebook Lengkap
                                        </h6>
                                        {book.ebook ? (
                                            <button
                                                type="button"
                                                className={`${primaryAction} self-start`}
                                                onClick={() =>
                                                    downloadEbook(book)
                                                }
                                                disabled={
                                                    busyKey ===
                                                    `ebook-${book.id}`
                                                }
                                            >
                                                <RiDownload2Line
                                                    size={16}
                                                    aria-hidden
                                                />
                                                {busyKey === `ebook-${book.id}`
                                                    ? 'Mengunduh...'
                                                    : 'Unduh Ebook'}
                                            </button>
                                        ) : (
                                            <p className="text-xs text-oxford-navy-900/65">
                                                Ebook belum diunggah admin.
                                            </p>
                                        )}
                                    </section>

                                    {/* Sertifikat HKI */}
                                    <section className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
                                        <h6 className="flex items-center gap-1.5 text-sm font-semibold text-oxford-navy-800">
                                            <RiShieldCheckLine
                                                size={16}
                                                aria-hidden
                                            />
                                            Sertifikat HKI
                                        </h6>
                                        {book.hki ? (
                                            <>
                                                <span
                                                    className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${hkiTone[book.hki.status]}`}
                                                >
                                                    {book.hki.status_label}
                                                </span>
                                                {book.hki
                                                    .registration_number && (
                                                    <p className="text-xs text-oxford-navy-900/70">
                                                        No.{' '}
                                                        {
                                                            book.hki
                                                                .registration_number
                                                        }
                                                    </p>
                                                )}
                                                {book.hki.certificate_id ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className={
                                                                primaryAction
                                                            }
                                                            onClick={() =>
                                                                openHki(
                                                                    book,
                                                                    book.hki!
                                                                        .certificate_id!,
                                                                    false
                                                                )
                                                            }
                                                            disabled={
                                                                busyKey ===
                                                                `hki-${book.id}`
                                                            }
                                                        >
                                                            <RiDownload2Line
                                                                size={16}
                                                                aria-hidden
                                                            />
                                                            Unduh
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={
                                                                secondaryAction
                                                            }
                                                            onClick={() =>
                                                                openHki(
                                                                    book,
                                                                    book.hki!
                                                                        .certificate_id!,
                                                                    true
                                                                )
                                                            }
                                                            disabled={
                                                                busyKey ===
                                                                `hki-${book.id}`
                                                            }
                                                        >
                                                            Lihat
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-oxford-navy-900/65">
                                                        Sertifikat diunggah
                                                        admin setelah HKI
                                                        terdaftar.
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-xs text-oxford-navy-900/65">
                                                Paket buku ini tidak termasuk
                                                layanan HKI.
                                            </p>
                                        )}
                                    </section>

                                    {/* Sertifikat penulis */}
                                    <section className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
                                        <h6 className="flex items-center gap-1.5 text-sm font-semibold text-oxford-navy-800">
                                            <RiAwardLine
                                                size={16}
                                                aria-hidden
                                            />
                                            Sertifikat Penulis
                                        </h6>
                                        {book.author_certificate ? (
                                            <button
                                                type="button"
                                                className={`${primaryAction} self-start`}
                                                onClick={() =>
                                                    certificate.download(
                                                        book.author_certificate!
                                                            .id
                                                    )
                                                }
                                                disabled={
                                                    certificate.busyId ===
                                                    book.author_certificate.id
                                                }
                                            >
                                                <RiDownload2Line
                                                    size={16}
                                                    aria-hidden
                                                />
                                                {certificate.busyId ===
                                                book.author_certificate.id
                                                    ? 'Mengunduh...'
                                                    : 'Unduh Sertifikat'}
                                            </button>
                                        ) : (
                                            <p className="text-xs text-oxford-navy-900/65">
                                                {book.author_certificate_note}
                                            </p>
                                        )}
                                        <Link
                                            to="/dashboard/sertifikat-saya"
                                            className="text-xs font-semibold text-forest-moss-700 hover:text-forest-moss-800"
                                        >
                                            Semua sertifikat di Sertifikat Saya
                                            →
                                        </Link>
                                    </section>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {viewer && (
                <PdfPreviewModal
                    url={viewer.url}
                    title={viewer.title}
                    onClose={closeViewer}
                />
            )}
        </div>
    );
}
