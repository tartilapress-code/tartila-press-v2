import { useRef, useState } from 'react';
import Button from '@/components/Button/Button';
import * as isbnApi from '@/data/isbn/isbnApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import { http } from '@/lib/http';
import {
    ATTACHMENT_MAX_BYTES,
    buildIsbnAttachment,
    coverForUpload,
    EncryptedDummyError,
    findTableOfContents,
    formatMegabytes,
    type TocRange,
} from '@/lib/isbnAttachment';

type Busy = 'dummy' | 'prepare' | 'build' | 'cover' | null;

const numberClass =
    'w-20 rounded-lg border border-oxford-navy-900/15 bg-white p-1.5 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

/** Nama berkas aman untuk Windows/macOS. */
function safeName(text: string): string {
    return (
        text
            .replace(/[\\/:*?"<>|]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80) || 'buku'
    );
}

/**
 * Lampiran formulir ISBN: dummy buku, file attachment (surat bertanda
 * tangan & berstempel + cover + dummy sampai Daftar Isi dalam satu PDF) dan
 * foto cover -- semuanya bisa diunduh.
 */
export default function IsbnAttachmentsBox({
    application,
    title,
    onProcessed,
}: {
    application: isbnApi.IsbnApplication & {
        attachments: isbnApi.IsbnAttachments;
    };
    title: string;
    onProcessed: () => Promise<unknown>;
}) {
    const attachments = application.attachments;
    const dummy = attachments.dummy;
    const published = Boolean(application.book_published);

    // PDF dummy disimpan sementara antara "Siapkan" dan "Unduh" supaya tidak
    // diunduh dua kali; dilepas saat panel ditutup.
    const dummyBytes = useRef<ArrayBuffer | null>(null);
    const [range, setRange] = useState<TocRange | null>(null);
    const [fromPage, setFromPage] = useState<string>('1');
    const [toPage, setToPage] = useState<string>('');
    const [withCover, setWithCover] = useState<boolean>(attachments.has_cover);
    const [busy, setBusy] = useState<Busy>(null);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [resultSize, setResultSize] = useState<number | null>(null);

    function fail(caught: unknown) {
        setIsError(true);
        setMessage(
            caught instanceof EncryptedDummyError
                ? caught.message
                : describeApiError(caught)
        );
    }

    async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
        setBusy(kind);
        setMessage('');
        setIsError(false);

        try {
            await task();
        } catch (caught) {
            fail(caught);
        } finally {
            setBusy(null);
        }
    }

    const downloadDummy = () =>
        run('dummy', async () => {
            const { blob, filename } = await isbnApi.adminDummy(application.id);
            saveBlob(blob, filename ?? dummy?.filename ?? 'dummy.pdf');
        });

    const downloadChapterFile = (
        file: isbnApi.IsbnAttachments['dummy_files'][number]
    ) =>
        run('dummy', async () => {
            const { blob, filename } = await http.fetchFile(
                `/manuscripts/${file.manuscript_id}/revisions/${file.revision_id}/download`
            );
            saveBlob(blob, filename ?? file.filename);
        });

    const prepare = () =>
        run('prepare', async () => {
            const { blob } = await isbnApi.adminDummy(application.id);
            const bytes = await blob.arrayBuffer();
            const found = await findTableOfContents(bytes);

            dummyBytes.current = bytes;
            setRange(found);
            setResultSize(null);
            setFromPage('1');
            setToPage(String(found.tocEnd ?? Math.min(found.pageCount, 10)));
        });

    const from = Number(fromPage);
    const to = Number(toPage);
    const pageCount = range?.pageCount ?? 0;
    const rangeValid =
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 1 &&
        to >= from &&
        to <= pageCount;

    const build = () =>
        run('build', async () => {
            const bytes = dummyBytes.current;
            if (!bytes || !rangeValid) return;

            // Surat berstempel; unduhan ini menandai surat sudah diproses.
            const letters = await isbnApi.adminDownload(application.id);
            const cover = withCover
                ? (await isbnApi.adminCover(application.id)).blob
                : null;

            const merged = await buildIsbnAttachment({
                letters: await letters.blob.arrayBuffer(),
                dummy: bytes,
                cover,
                fromPage: from,
                toPage: to,
            });

            saveBlob(merged, `File Attachment ISBN - ${safeName(title)}.pdf`);
            setResultSize(merged.size);

            if (application.status !== 'processed') await onProcessed();
        });

    const downloadCover = () =>
        run('cover', async () => {
            const { blob } = await isbnApi.adminCover(application.id);
            const cover = await coverForUpload(blob);

            saveBlob(
                cover.blob,
                `Cover - ${safeName(title)}.${cover.extension}`
            );
        });

    const showChapterFiles =
        attachments.dummy_files.length > 1 ||
        (dummy === null && attachments.dummy_files.length > 0);

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3">
            <p className="text-oxford-navy-900 text-sm font-semibold">
                Lampiran
            </p>

            {/* 1. Dummy buku */}
            <section className="flex flex-col gap-1.5">
                <p className="text-oxford-navy-900/70 text-xs">
                    <span className="font-semibold">Dummy buku</span>{' '}
                    {dummy
                        ? `(${dummy.label.toLowerCase()}): ${dummy.filename}`
                        : ''}
                </p>
                {dummy ? (
                    <Button
                        variant="outline2"
                        className="self-start"
                        disabled={busy !== null}
                        onClick={downloadDummy}
                    >
                        {busy === 'dummy' ? 'Mengunduh...' : 'Unduh dummy'}
                    </Button>
                ) : (
                    <p className="text-amber-700 text-xs">
                        Belum ada berkas naskah.
                    </p>
                )}
                {showChapterFiles && (
                    <div className="flex flex-col gap-1">
                        <p className="text-oxford-navy-900/60 text-xs">
                            Naskah per bab:
                        </p>
                        {attachments.dummy_files.map((file) => (
                            <button
                                key={file.revision_id}
                                type="button"
                                className="self-start text-forest-moss-700 text-xs underline hover:cursor-pointer disabled:opacity-50"
                                disabled={busy !== null}
                                onClick={() => downloadChapterFile(file)}
                            >
                                Unduh {file.label}: {file.filename}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* 2. File attachment */}
            <section className="flex flex-col gap-1.5 border-t border-forest-moss-100 pt-3">
                <p className="text-oxford-navy-900/70 text-xs">
                    <span className="font-semibold">File attachment</span> (PDF
                    maks. 5 MB): satu PDF berisi Surat Permohonan ISBN dan Surat
                    Keaslian Karya (bertanda tangan & berstempel), foto cover,
                    lalu dummy buku dari halaman awal sampai Daftar Isi (Halaman
                    Judul, Balik Halaman Judul, Kata Pengantar, Daftar Isi).
                </p>

                {!published ? (
                    <p className="text-amber-700 text-xs">
                        Terbitkan bukunya dulu — surat baru bisa diberi tanda
                        tangan & stempel setelah buku terbit.
                    </p>
                ) : !dummy ? (
                    <p className="text-amber-700 text-xs">
                        Belum ada dummy buku untuk digabung.
                    </p>
                ) : !dummy.is_pdf ? (
                    <p className="text-amber-700 text-xs">
                        Dummy masih berupa Word ({dummy.filename}). Hanya PDF
                        yang bisa digabung: minta editor mengunggah dummy PDF,
                        atau unggah ebook PDF di halaman buku.
                    </p>
                ) : range === null ? (
                    <Button
                        variant="outline2"
                        className="self-start"
                        disabled={busy !== null}
                        onClick={prepare}
                    >
                        {busy === 'prepare'
                            ? 'Membaca dummy...'
                            : 'Siapkan file attachment'}
                    </Button>
                ) : (
                    <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100">
                        {range.tocStart !== null ? (
                            <p className="text-forest-moss-700 text-xs">
                                Daftar Isi ditemukan di halaman{' '}
                                {range.tocStart === range.tocEnd
                                    ? range.tocStart
                                    : `${range.tocStart}–${range.tocEnd}`}{' '}
                                dari {range.pageCount} halaman dummy.
                            </p>
                        ) : (
                            <p className="text-amber-700 text-xs">
                                Daftar Isi tidak ditemukan otomatis (dummy{' '}
                                {range.pageCount} halaman). Isi sendiri halaman
                                terakhir Daftar Isi.
                            </p>
                        )}

                        <div className="flex flex-row flex-wrap items-center gap-2 text-sm text-oxford-navy-900">
                            <span>Halaman dummy</span>
                            <input
                                type="number"
                                min={1}
                                max={pageCount}
                                className={numberClass}
                                aria-label="Halaman dummy pertama"
                                value={fromPage}
                                onChange={(e) => setFromPage(e.target.value)}
                            />
                            <span>sampai</span>
                            <input
                                type="number"
                                min={1}
                                max={pageCount}
                                className={numberClass}
                                aria-label="Halaman dummy terakhir"
                                value={toPage}
                                onChange={(e) => setToPage(e.target.value)}
                            />
                        </div>
                        {!rangeValid && (
                            <p className="text-red-600 text-xs">
                                Rentang halaman harus 1–{pageCount} dan halaman
                                awal tidak lebih besar dari halaman akhir.
                            </p>
                        )}

                        <label className="flex flex-row items-center gap-2 text-sm text-oxford-navy-900">
                            <input
                                type="checkbox"
                                checked={withCover}
                                disabled={!attachments.has_cover}
                                onChange={(e) => setWithCover(e.target.checked)}
                            />
                            Sisipkan foto cover sebelum halaman dummy
                            {!attachments.has_cover && (
                                <span className="text-amber-700 text-xs">
                                    (belum ada cover di data buku)
                                </span>
                            )}
                        </label>
                        <p className="text-oxford-navy-900/60 text-xs">
                            Matikan bila halaman pertama dummy sudah berupa
                            cover. Mengunduh file attachment juga menandai surat
                            ini sudah diproses.
                        </p>

                        <div className="flex flex-row flex-wrap gap-2">
                            <Button
                                variant="primary"
                                disabled={busy !== null || !rangeValid}
                                onClick={build}
                            >
                                {busy === 'build'
                                    ? 'Menggabungkan...'
                                    : 'Unduh file attachment'}
                            </Button>
                            <Button
                                variant="outline2"
                                disabled={busy !== null}
                                onClick={prepare}
                            >
                                Baca ulang dummy
                            </Button>
                        </div>

                        {resultSize !== null && (
                            <p
                                className={`text-xs ${resultSize > ATTACHMENT_MAX_BYTES ? 'text-red-600' : 'text-forest-moss-700'}`}
                            >
                                Ukuran file attachment:{' '}
                                {formatMegabytes(resultSize)}
                                {resultSize > ATTACHMENT_MAX_BYTES
                                    ? ' — melebihi 5 MB. Kurangi rentang halaman, matikan foto cover, atau kompres PDF-nya dulu.'
                                    : ' (di bawah batas 5 MB).'}
                            </p>
                        )}
                    </div>
                )}
            </section>

            {/* 3. Cover */}
            <section className="flex flex-col gap-1.5 border-t border-forest-moss-100 pt-3">
                <p className="text-oxford-navy-900/70 text-xs">
                    <span className="font-semibold">Cover buku</span> (JPG/PNG
                    maks. 5 MB)
                </p>
                {attachments.has_cover ? (
                    <Button
                        variant="outline2"
                        className="self-start"
                        disabled={busy !== null}
                        onClick={downloadCover}
                    >
                        {busy === 'cover' ? 'Mengunduh...' : 'Unduh cover'}
                    </Button>
                ) : (
                    <p className="text-amber-700 text-xs">
                        Belum ada cover di data buku.
                    </p>
                )}
            </section>

            {message && (
                <p
                    className={`text-xs ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}
        </div>
    );
}
