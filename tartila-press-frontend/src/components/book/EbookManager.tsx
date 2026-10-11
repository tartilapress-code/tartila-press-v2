import { useState } from 'react';
import Button from '@/components/Button/Button';
import * as publishedBookApi from '@/data/publishedBook/publishedBookApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import { readPdfPageCount } from '@/lib/pdfPageCount';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

/**
 * Ebook lengkap sebuah buku (admin): unggah/ganti, unduh, hapus. Ebook
 * bersifat privat — hanya penulis buku yang bisa mengunduh dari "Buku Terbit".
 * Ebook PDF yang sama dibaca di Tartila Book (tidak perlu diunggah lagi di sana).
 */
export default function EbookManager({
    bookId,
    ebookName,
    uploadedAt,
    pages,
    inTartilaBook,
    onChanged,
}: {
    bookId: number;
    ebookName: string | null;
    uploadedAt: string | null;
    pages: number | null;
    inTartilaBook: boolean;
    onChanged: () => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<'upload' | 'download' | 'delete' | null>(
        null
    );
    const [error, setError] = useState<string>('');
    // Mengosongkan input berkas setelah unggah berhasil.
    const [inputKey, setInputKey] = useState<number>(0);

    async function run(
        kind: 'upload' | 'download' | 'delete',
        task: () => Promise<void>
    ) {
        setBusy(kind);
        setError('');

        try {
            await task();
        } catch (failure) {
            setError(describeApiError(failure));
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
            <p className="text-sm text-oxford-navy-900">
                <span className="font-semibold">Ebook lengkap (penulis):</span>{' '}
                {ebookName ? (
                    <>
                        {ebookName}
                        {uploadedAt && (
                            <span className="text-oxford-navy-900/65">
                                {' '}
                                · {dateFormatter.format(new Date(uploadedAt))}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-oxford-navy-900/65">belum ada</span>
                )}
            </p>
            <div className="flex flex-row flex-wrap items-center gap-2">
                <input
                    key={inputKey}
                    type="file"
                    accept=".pdf,.epub,application/pdf,application/epub+zip"
                    aria-label="Pilih berkas ebook (PDF/EPUB, maks. 200 MB)"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-52 text-xs text-oxford-navy-900"
                />
                <Button
                    variant="outline2"
                    disabled={!file || busy !== null}
                    onClick={() =>
                        run('upload', async () => {
                            if (!file) return;
                            const isPdf = /\.pdf$/i.test(file.name);
                            // Tartila Book butuh jumlah halaman; dibaca dari PDF di peramban.
                            const pageCount = isPdf
                                ? await readPdfPageCount(file).catch(
                                      () => undefined
                                  )
                                : undefined;
                            await publishedBookApi.adminUploadEbook(
                                bookId,
                                file,
                                pageCount
                            );
                            setFile(null);
                            setInputKey((key) => key + 1);
                            onChanged();
                        })
                    }
                >
                    {busy === 'upload'
                        ? 'Mengunggah...'
                        : ebookName
                          ? 'Ganti Ebook'
                          : 'Upload Ebook'}
                </Button>
                {ebookName && (
                    <>
                        <Button
                            variant="outline2"
                            disabled={busy !== null}
                            onClick={() =>
                                run('download', async () => {
                                    const { blob, filename } =
                                        await publishedBookApi.adminEbookFile(
                                            bookId
                                        );
                                    saveBlob(blob, filename ?? 'ebook.pdf');
                                })
                            }
                        >
                            Unduh
                        </Button>
                        <Button
                            variant="outline2"
                            disabled={busy !== null}
                            onClick={() => {
                                if (
                                    !window.confirm(
                                        'Hapus ebook ini? Penulis tidak bisa mengunduhnya lagi.'
                                    )
                                ) {
                                    return;
                                }

                                run('delete', async () => {
                                    await publishedBookApi.adminDeleteEbook(
                                        bookId
                                    );
                                    onChanged();
                                });
                            }}
                        >
                            Hapus Ebook
                        </Button>
                    </>
                )}
            </div>
            <small className="text-xs text-oxford-navy-900/65">
                PDF atau EPUB, maks. 200 MB. Penulis mendapat notifikasi saat
                ebook diunggah.{' '}
                {!ebookName
                    ? 'Ebook PDF yang diunggah di sini juga bisa dibaca di Tartila Book.'
                    : inTartilaBook
                      ? `Siap dipakai di Tartila Book (${pages} halaman).`
                      : 'Belum bisa dipakai di Tartila Book: perlu PDF dengan jumlah halaman yang terbaca (EPUB tidak didukung).'}
            </small>
            {error && (
                <p role="alert" className="text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
