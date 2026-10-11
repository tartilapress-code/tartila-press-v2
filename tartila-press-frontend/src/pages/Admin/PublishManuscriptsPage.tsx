import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import IsbnFormPanel from '@/components/isbn/IsbnFormPanel';
import PublicationProcessPanel from '@/components/publication/PublicationProcessPanel';
import * as isbnApi from '@/data/isbn/isbnApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import Pagination from '@/components/ui/Pagination';
import type { PageMeta } from '@/lib/pagination';

const STATUS_CLASS: Record<isbnApi.IsbnStatus, string> = {
    draft: 'bg-oxford-navy-100 text-oxford-navy-700',
    signed: 'bg-amber-100 text-amber-800',
    processed: 'bg-forest-moss-100 text-forest-moss-800',
};

export default function PublishManuscriptsPage() {
    const [items, setItems] = useState<isbnApi.IsbnApplication[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<string>('signed');
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [processId, setProcessId] = useState<number | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);

    // Status & halaman dikerjakan server.
    const load = useCallback(() => {
        return isbnApi
            .adminList({ status: filter === 'all' ? '' : filter, page })
            .then((response) => {
                setItems(response.data);
                setMeta(response.meta ?? null);
            })
            .catch((caught) => {
                setIsError(true);
                setMessage(describeApiError(caught));
            })
            .finally(() => setIsLoading(false));
    }, [filter, page]);

    useEffect(() => {
        load();
    }, [load]);

    async function run(id: number, action: () => Promise<void>) {
        setBusyId(id);
        setMessage('');
        setIsError(false);

        try {
            await action();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setBusyId(null);
        }
    }

    const preview = (item: isbnApi.IsbnApplication) =>
        run(item.id, async () => {
            const { blob } = await isbnApi.adminDownload(item.id, true);
            setPreviewUrl(URL.createObjectURL(blob));
        });

    const download = (item: isbnApi.IsbnApplication) =>
        run(item.id, async () => {
            const { blob, filename } = await isbnApi.adminDownload(item.id);
            saveBlob(blob, filename ?? 'surat-isbn.pdf');
            setMessage(
                'Surat bertanda tangan dan stempel diunduh. E-meterai ditambahkan di luar sistem.'
            );
            await load();
        });

    const visible = items;

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Terbitkan Naskah
            </h5>
            <p className="text-oxford-navy-900/80 text-sm">
                Naskah yang sudah siap diterbitkan: surat permohonan ISBN dan
                surat keaslian karya sudah ditandatangani penulis/editor. Unduh
                untuk mendapatkan surat dengan tanda tangan dan stempel
                penanggung jawab; e-meterai ditambahkan di luar sistem. Tanda
                tangan, stempel, dan isi surat diatur di{' '}
                <Link
                    to="/admin/isbn-settings"
                    className="text-forest-moss-700 underline"
                >
                    Template Surat ISBN
                </Link>
                .
            </p>

            <select
                value={filter}
                onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                }}
                className="self-start rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
            >
                <option value="signed">Siap diterbitkan</option>
                <option value="processed">Sudah diproses</option>
                <option value="all">Semua</option>
            </select>

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : visible.length === 0 ? (
                <p className="text-oxford-navy-900/60 text-sm">
                    Tidak ada naskah.
                </p>
            ) : (
                visible.map((item) => (
                    <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-4"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex flex-row flex-wrap items-center gap-2">
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {item.title}
                                    </p>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status]}`}
                                    >
                                        {isbnApi.STATUS_LABEL[item.status]}
                                    </span>
                                </div>
                                <p className="text-oxford-navy-900/70 text-xs">
                                    {item.type === 'chapter'
                                        ? 'Book Chapter'
                                        : 'Paket biasa'}{' '}
                                    • {item.authors_text}
                                </p>
                                {item.book_published ? (
                                    <p className="text-oxford-navy-900/60 text-xs break-all">
                                        Link buku: {item.book_url}
                                    </p>
                                ) : (
                                    <p className="text-amber-700 text-xs">
                                        Buku belum diterbitkan —{' '}
                                        {item.type === 'chapter' ? (
                                            <Link
                                                to={`/admin/book-chapter-projects/${item.book_id}`}
                                                className="underline"
                                            >
                                                terbitkan proyek Book Chapter
                                            </Link>
                                        ) : (
                                            <Link
                                                to={`/dashboard/naskah/${item.manuscript_id}`}
                                                className="underline"
                                            >
                                                terbitkan buku dari naskah
                                            </Link>
                                        )}{' '}
                                        dulu, lalu lanjut tanda tangan.
                                    </p>
                                )}
                                <p className="text-oxford-navy-900/60 text-xs">
                                    {item.letter_number} • ditandatangani{' '}
                                    {item.signer_role.toLowerCase()}{' '}
                                    {item.applicant?.name}{' '}
                                    {item.signed_at &&
                                        new Date(
                                            item.signed_at
                                        ).toLocaleDateString('id-ID')}
                                </p>
                            </div>
                            <div className="flex flex-row flex-wrap gap-2 shrink-0">
                                <Button
                                    variant="outline2"
                                    onClick={() =>
                                        setOpenId(
                                            openId === item.id ? null : item.id
                                        )
                                    }
                                >
                                    {openId === item.id
                                        ? 'Tutup data ISBN'
                                        : 'Data pengisian ISBN'}
                                </Button>
                                <Button
                                    variant="outline2"
                                    onClick={() =>
                                        setProcessId(
                                            processId === item.id
                                                ? null
                                                : item.id
                                        )
                                    }
                                >
                                    {processId === item.id
                                        ? 'Tutup proses'
                                        : 'Proses penerbitan'}
                                </Button>
                                <Button
                                    variant="outline2"
                                    disabled={
                                        busyId === item.id ||
                                        !item.book_published
                                    }
                                    onClick={() => preview(item)}
                                >
                                    Pratinjau
                                </Button>
                                <Button
                                    variant="primary"
                                    disabled={
                                        busyId === item.id ||
                                        !item.book_published
                                    }
                                    onClick={() => download(item)}
                                >
                                    {item.status === 'processed'
                                        ? 'Unduh lagi'
                                        : 'Beri TTD & stempel, unduh'}
                                </Button>
                            </div>
                        </div>
                        {openId === item.id &&
                            item.form &&
                            item.attachments && (
                                <IsbnFormPanel
                                    application={{
                                        ...item,
                                        form: item.form,
                                        attachments: item.attachments,
                                    }}
                                    onSaved={load}
                                />
                            )}
                        {processId === item.id && (
                            <PublicationProcessPanel applicationId={item.id} />
                        )}
                    </div>
                ))
            )}

            <Pagination meta={meta} onPageChange={setPage} />

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title="Surat ISBN (dengan tanda tangan & stempel)"
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
