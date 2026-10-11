import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as mouApi from '@/data/mou/mouApi';
import { describeApiError } from '@/lib/apiErrors';

/** Royalti Saya: MOU distribusi buku milik penulis (status, tanda tangan, PDF). */
export default function MyMouList() {
    const [items, setItems] = useState<mouApi.MyMouItem[] | null>(null);
    const [error, setError] = useState<string>('');
    const [busyId, setBusyId] = useState<number | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        mouApi
            .mine()
            .then((response) => {
                if (active) setItems(response.data);
            })
            .catch((caught) => {
                if (active) setError(describeApiError(caught));
            });

        return () => {
            active = false;
        };
    }, []);

    if (items === null && !error) {
        return null;
    }

    async function open(id: number) {
        setBusyId(id);
        setError('');

        try {
            const { blob } = await mouApi.pdf(id, true);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setBusyId(null);
        }
    }

    const needsAction = (item: mouApi.MyMouItem) =>
        item.me !== null && !item.me.signed && item.status === 'pending';

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    MOU Distribusi Buku
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Perjanjian distribusi dan royalti untuk tiap judul buku
                    Anda. Semua penulis menandatangani sebelum buku diterbitkan;
                    MOU bermeterai dari penerbit bisa dibuka di sini.
                </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {items !== null && items.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada MOU. MOU dibuat setelah naskah Anda selesai.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {(items ?? []).map((item) => (
                        <div
                            key={item.id}
                            className={`flex flex-col gap-3 rounded-lg p-4 ring-1 sm:flex-row sm:items-center sm:justify-between ${needsAction(item) ? 'bg-amber-50 ring-amber-200' : 'bg-forest-moss-50 ring-forest-moss-100'}`}
                        >
                            <div className="flex min-w-0 flex-col gap-1">
                                <p className="font-semibold text-oxford-navy-900">
                                    {item.title}
                                </p>
                                <p className="text-xs text-oxford-navy-900/65">
                                    {item.number} • {item.type_label}
                                    {item.mine &&
                                        ` • Royalti Anda: fisik ${item.royalty_types?.physical ? mouApi.percent(item.mine.royalty_physical) : '—'}, ebook ${item.royalty_types?.ebook ? mouApi.percent(item.mine.royalty_ebook) : '—'}`}
                                </p>
                                <div className="flex flex-row flex-wrap items-center gap-2">
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${mouApi.STATUS_CLASS[item.status]}`}
                                    >
                                        {item.status_label}
                                    </span>
                                    {item.me?.signed ? (
                                        <span className="text-xs text-forest-moss-700">
                                            Anda menandatangani{' '}
                                            {mouApi.formatSignedAt(
                                                item.me.signed_at
                                            )}
                                        </span>
                                    ) : (
                                        needsAction(item) && (
                                            <span className="text-xs font-semibold text-amber-800">
                                                Perlu tanda tangan Anda
                                            </span>
                                        )
                                    )}
                                    {item.addenda.length > 0 && (
                                        <span className="text-xs text-oxford-navy-900/65">
                                            {item.addenda.length} adendum
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-row flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={busyId === item.id}
                                    onClick={() => open(item.id)}
                                    className="rounded-lg px-3 py-2 text-sm font-semibold text-oxford-navy-800 ring-1 ring-oxford-navy-900/20 hover:cursor-pointer hover:bg-white disabled:opacity-50"
                                >
                                    {item.has_final
                                        ? 'MOU bermeterai'
                                        : 'Lihat PDF'}
                                </button>
                                <Link
                                    to={`/dashboard/mou/${item.id}`}
                                    className="rounded-lg bg-oxford-navy-700 px-3 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600"
                                >
                                    {needsAction(item)
                                        ? 'Tinjau & tanda tangani'
                                        : 'Detail'}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title="MOU distribusi buku"
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
