import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import MouContentFields, {
    type MouContentDraft,
} from '@/components/mou/MouContentFields';
import MouDocument from '@/components/mou/MouDocument';
import * as mouApi from '@/data/mou/mouApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

const numberClass =
    'w-24 rounded-lg border border-oxford-navy-900/15 bg-white p-1.5 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

type Editor = MouContentDraft & {
    royalty_types: { physical: boolean; ebook: boolean };
    pool: { physical: string; ebook: string };
    royalties: Record<number, { physical: string; ebook: string }>;
    choice: string;
    reset: boolean;
};

function toEditor(mou: mouApi.Mou): Editor {
    const content = mou.content;

    return {
        title: content.title,
        opening: content.opening,
        distribution_options: content.distribution_options,
        distribution_mode: content.distribution_mode,
        first_party_terms: content.first_party_terms,
        second_party_terms: content.second_party_terms,
        closing_terms: content.closing_terms,
        contact_note: content.contact_note,
        royalty_types: content.royalty_types,
        pool: {
            physical: String(content.royalty.physical ?? 0),
            ebook: String(content.royalty.ebook ?? 0),
        },
        royalties: Object.fromEntries(
            mou.signatories.map((row) => [
                row.user_id,
                {
                    physical: String(row.royalty_physical ?? 0),
                    ebook: String(row.royalty_ebook ?? 0),
                },
            ])
        ),
        choice: mou.distribution_choice[0] ?? '',
        reset: false,
    };
}

/** Admin: satu MOU — PDF bertanda tangan & stempel, PDF bermeterai, adendum, penyesuaian isi. */
export default function MouDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [mou, setMou] = useState<mouApi.Mou | null>(null);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [finalFile, setFinalFile] = useState<File | null>(null);
    const [addendum, setAddendum] = useState<{
        title: string;
        note: string;
        file: File | null;
    }>({ title: '', note: '', file: null });

    const apply = useCallback((next: mouApi.Mou) => {
        setMou(next);
        setEditor(null);
    }, []);

    useEffect(() => {
        let active = true;

        mouApi
            .adminGet(id ?? '')
            .then((response) => {
                if (active) apply(response.data);
            })
            .catch((caught) => {
                if (active) {
                    setIsError(true);
                    setMessage(describeApiError(caught));
                }
            });

        return () => {
            active = false;
        };
    }, [id, apply]);

    async function run(task: () => Promise<string | void>) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const done = await task();
            if (done) setMessage(done);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    if (!mou) {
        return (
            <div className={cardClass}>
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-oxford-navy-900/70'}`}
                >
                    {message || 'Memuat...'}
                </p>
            </div>
        );
    }

    const current = mou;
    const binding = current.status !== 'pending';
    const signedCount = current.signatories.filter(
        (row) => row.signed_at
    ).length;

    const preview = (fetcher: () => Promise<{ blob: Blob }>) =>
        run(async () => {
            const { blob } = await fetcher();
            setPreviewUrl(URL.createObjectURL(blob));
        });

    const downloadSealed = () =>
        run(async () => {
            const { blob, filename } = await mouApi.adminPdf(current.id);
            saveBlob(blob, filename ?? 'mou.pdf');
        });

    const uploadFinal = () =>
        run(async () => {
            if (!finalFile) return;
            const response = await mouApi.adminUploadFinal(
                current.id,
                finalFile
            );
            setFinalFile(null);
            apply(response.data);

            return response.message;
        });

    const addAddendum = () =>
        run(async () => {
            if (!addendum.file || !addendum.title.trim()) return;
            const response = await mouApi.adminAddAddendum(current.id, {
                title: addendum.title.trim(),
                note: addendum.note.trim() || undefined,
                file: addendum.file,
            });
            setAddendum({ title: '', note: '', file: null });
            apply(response.data);

            return response.message;
        });

    function splitEvenly(type: 'physical' | 'ebook') {
        if (!editor) return;
        const pool = Number(editor.pool[type]) || 0;
        const each = current.signatories.length
            ? Math.round((pool / current.signatories.length) * 10000) / 10000
            : 0;

        setEditor({
            ...editor,
            royalties: Object.fromEntries(
                current.signatories.map((row) => [
                    row.user_id,
                    { ...editor.royalties[row.user_id], [type]: String(each) },
                ])
            ),
        });
    }

    const saveEditor = () =>
        run(async () => {
            if (!editor) return;
            const response = await mouApi.adminUpdate(current.id, {
                title: editor.title,
                opening: editor.opening,
                distribution_options: editor.distribution_options,
                distribution_mode: editor.distribution_mode,
                first_party_terms: editor.first_party_terms,
                second_party_terms: editor.second_party_terms,
                closing_terms: editor.closing_terms,
                contact_note: editor.contact_note,
                royalty_types: editor.royalty_types,
                royalty_pool: {
                    physical: Number(editor.pool.physical) || 0,
                    ebook: Number(editor.pool.ebook) || 0,
                },
                royalties: current.signatories.map((row) => ({
                    user_id: row.user_id,
                    physical:
                        Number(editor.royalties[row.user_id]?.physical) || 0,
                    ebook: Number(editor.royalties[row.user_id]?.ebook) || 0,
                })),
                distribution_choice:
                    editor.distribution_mode === 'one' && editor.choice
                        ? [editor.choice]
                        : null,
                reset_signatures: editor.reset,
            });
            apply(response.data);

            return response.message;
        });

    const resetToTemplate = () =>
        run(async () => {
            const response = await mouApi.adminResetToTemplate(current.id);
            apply(response.data);

            return response.message;
        });

    return (
        <div className="flex max-w-4xl flex-col gap-6">
            <div className={cardClass}>
                <Link
                    to="/admin/mou"
                    className="self-start text-sm text-forest-moss-700 hover:underline"
                >
                    ← Daftar MOU
                </Link>
                <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                        {current.title}
                    </h5>
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${mouApi.STATUS_CLASS[current.status]}`}
                    >
                        {current.status_label}
                    </span>
                </div>
                <p className="text-sm text-oxford-navy-900/70">
                    {current.number} • {current.type_label} • {signedCount} dari{' '}
                    {current.signatories.length} penulis sudah tanda tangan
                    {current.customized && ' • isi disesuaikan untuk judul ini'}
                </p>

                <div className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3">
                    <p className="text-sm font-semibold text-oxford-navy-900">
                        1. Tanda tangan, stempel & meterai penerbit
                    </p>
                    <p className="text-xs text-oxford-navy-900/70">
                        {binding
                            ? 'Semua penulis sudah menandatangani. Unduh MOU dengan tanda tangan & stempel penerbit, bubuhkan meterai (e-meterai) di luar sistem, lalu unggah PDF bermeterai.'
                            : 'Menunggu semua penulis menandatangani. Pratinjau menampilkan MOU tanpa tanda tangan penerbit.'}
                    </p>
                    <div className="flex flex-row flex-wrap gap-2">
                        <Button
                            variant="outline2"
                            disabled={isBusy}
                            onClick={() =>
                                preview(() => mouApi.adminPdf(current.id, true))
                            }
                        >
                            Pratinjau PDF
                        </Button>
                        <Button
                            variant="primary"
                            disabled={isBusy || !binding}
                            onClick={downloadSealed}
                        >
                            Unduh MOU bertanda tangan & stempel
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3">
                    <p className="text-sm font-semibold text-oxford-navy-900">
                        2. PDF bermeterai (dibuka penulis di Royalti Saya)
                    </p>
                    {current.has_final && (
                        <div className="flex flex-row flex-wrap items-center gap-2 text-sm">
                            <span className="text-forest-moss-700">
                                Sudah diunggah{' '}
                                {mouApi.formatSignedAt(
                                    current.final_uploaded_at
                                )}
                                .
                            </span>
                            <button
                                type="button"
                                className="text-forest-moss-700 underline hover:cursor-pointer"
                                onClick={() =>
                                    preview(() =>
                                        mouApi.adminFinalPdf(current.id, true)
                                    )
                                }
                            >
                                Lihat
                            </button>
                            <button
                                type="button"
                                className="text-red-600 underline hover:cursor-pointer"
                                onClick={() =>
                                    run(async () => {
                                        if (
                                            !window.confirm(
                                                'Hapus PDF bermeterai? Penulis tidak bisa membukanya lagi sampai diunggah ulang.'
                                            )
                                        ) {
                                            return;
                                        }
                                        const response =
                                            await mouApi.adminDeleteFinal(
                                                current.id
                                            );
                                        apply(response.data);

                                        return response.message;
                                    })
                                }
                            >
                                Hapus
                            </button>
                        </div>
                    )}
                    {binding ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                type="file"
                                accept="application/pdf"
                                aria-label="PDF MOU bermeterai"
                                className="text-sm"
                                onChange={(e) =>
                                    setFinalFile(e.target.files?.[0] ?? null)
                                }
                            />
                            <Button
                                variant="primary"
                                disabled={isBusy || !finalFile}
                                onClick={uploadFinal}
                            >
                                {current.has_final
                                    ? 'Ganti PDF bermeterai'
                                    : 'Unggah PDF bermeterai'}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs text-amber-700">
                            Bisa diunggah setelah semua penulis menandatangani.
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3">
                    <p className="text-sm font-semibold text-oxford-navy-900">
                        Adendum
                    </p>
                    <p className="text-xs text-oxford-navy-900/70">
                        Perubahan isi diajukan penulis lewat email resmi dan
                        berlaku bila disetujui kedua pihak. Unggah PDF adendum
                        yang sudah disepakati.
                    </p>
                    {current.addenda.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-row flex-wrap items-center gap-2 text-sm"
                        >
                            <span className="text-oxford-navy-900">
                                {item.title}
                                {item.note ? ` — ${item.note}` : ''}
                            </span>
                            <button
                                type="button"
                                className="text-forest-moss-700 underline hover:cursor-pointer"
                                onClick={() =>
                                    preview(() =>
                                        mouApi.adminAddendumFile(
                                            current.id,
                                            item.id,
                                            true
                                        )
                                    )
                                }
                            >
                                Lihat
                            </button>
                            <button
                                type="button"
                                className="text-red-600 underline hover:cursor-pointer"
                                onClick={() =>
                                    run(async () => {
                                        if (
                                            !window.confirm(
                                                'Hapus adendum ini?'
                                            )
                                        ) {
                                            return;
                                        }
                                        const response =
                                            await mouApi.adminDeleteAddendum(
                                                current.id,
                                                item.id
                                            );
                                        apply(response.data);

                                        return response.message;
                                    })
                                }
                            >
                                Hapus
                            </button>
                        </div>
                    ))}
                    <div className="flex flex-col gap-2">
                        <input
                            className="rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                            placeholder="Judul adendum"
                            aria-label="Judul adendum"
                            maxLength={150}
                            value={addendum.title}
                            onChange={(e) =>
                                setAddendum({
                                    ...addendum,
                                    title: e.target.value,
                                })
                            }
                        />
                        <input
                            className="rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm"
                            placeholder="Catatan (opsional)"
                            aria-label="Catatan adendum"
                            maxLength={2000}
                            value={addendum.note}
                            onChange={(e) =>
                                setAddendum({
                                    ...addendum,
                                    note: e.target.value,
                                })
                            }
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                type="file"
                                accept="application/pdf"
                                aria-label="PDF adendum"
                                className="text-sm"
                                onChange={(e) =>
                                    setAddendum({
                                        ...addendum,
                                        file: e.target.files?.[0] ?? null,
                                    })
                                }
                            />
                            <Button
                                variant="outline2"
                                disabled={
                                    isBusy ||
                                    !addendum.file ||
                                    !addendum.title.trim()
                                }
                                onClick={addAddendum}
                            >
                                Tambah adendum
                            </Button>
                        </div>
                    </div>
                </div>

                {message && (
                    <p
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}
            </div>

            <MouDocument mou={current} />

            {current.status !== 'completed' && (
                <div className={cardClass}>
                    <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                        <h5 className="font-display text-lg font-bold text-oxford-navy-700">
                            Sesuaikan isi MOU judul ini
                        </h5>
                        {!editor && (
                            <Button
                                variant="outline2"
                                onClick={() => setEditor(toEditor(current))}
                            >
                                Ubah isi
                            </Button>
                        )}
                    </div>
                    <p className="text-sm text-oxford-navy-900/70">
                        Perubahan di sini hanya untuk judul ini (template utama
                        tidak berubah).
                        {current.customized &&
                            signedCount === 0 &&
                            ' Judul ini sedang memakai isi yang disesuaikan.'}
                    </p>
                    {current.customized && signedCount === 0 && !editor && (
                        <Button
                            variant="outline2"
                            className="self-start"
                            disabled={isBusy}
                            onClick={resetToTemplate}
                        >
                            Kembali ikuti template utama
                        </Button>
                    )}

                    {editor && (
                        <div className="flex flex-col gap-5">
                            <fieldset className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3">
                                <legend className="text-sm font-semibold text-oxford-navy-900">
                                    Royalti
                                </legend>
                                <div className="flex flex-row flex-wrap gap-4 text-sm text-oxford-navy-900">
                                    {(['physical', 'ebook'] as const).map(
                                        (type) => (
                                            <label
                                                key={type}
                                                className="flex flex-row items-center gap-2"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        editor.royalty_types[
                                                            type
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        setEditor({
                                                            ...editor,
                                                            royalty_types: {
                                                                ...editor.royalty_types,
                                                                [type]: e.target
                                                                    .checked,
                                                            },
                                                        })
                                                    }
                                                />
                                                Royalti{' '}
                                                {type === 'physical'
                                                    ? 'buku fisik'
                                                    : 'ebook'}{' '}
                                                berlaku, total
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    className={numberClass}
                                                    aria-label={`Total royalti ${type === 'physical' ? 'buku fisik' : 'ebook'}`}
                                                    value={editor.pool[type]}
                                                    disabled={
                                                        !editor.royalty_types[
                                                            type
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        setEditor({
                                                            ...editor,
                                                            pool: {
                                                                ...editor.pool,
                                                                [type]: e.target
                                                                    .value,
                                                            },
                                                        })
                                                    }
                                                />
                                                %
                                                <button
                                                    type="button"
                                                    className="text-xs font-semibold text-forest-moss-700 hover:underline hover:cursor-pointer"
                                                    onClick={() =>
                                                        splitEvenly(type)
                                                    }
                                                >
                                                    Bagi rata
                                                </button>
                                            </label>
                                        )
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[26rem] text-sm">
                                        <thead>
                                            <tr className="text-left text-oxford-navy-900/70">
                                                <th className="p-1 font-medium">
                                                    Penulis
                                                </th>
                                                <th className="p-1 font-medium">
                                                    Fisik (%)
                                                </th>
                                                <th className="p-1 font-medium">
                                                    Ebook (%)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {current.signatories.map((row) => (
                                                <tr key={row.user_id}>
                                                    <td className="p-1 text-oxford-navy-900">
                                                        {row.name}
                                                        {row.chapters !==
                                                            null &&
                                                            ` (${row.chapters} bab)`}
                                                    </td>
                                                    {(
                                                        [
                                                            'physical',
                                                            'ebook',
                                                        ] as const
                                                    ).map((type) => (
                                                        <td
                                                            key={type}
                                                            className="p-1"
                                                        >
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                step="0.0001"
                                                                className={
                                                                    numberClass
                                                                }
                                                                aria-label={`Royalti ${type === 'physical' ? 'buku fisik' : 'ebook'} ${row.name}`}
                                                                disabled={
                                                                    !editor
                                                                        .royalty_types[
                                                                        type
                                                                    ]
                                                                }
                                                                value={
                                                                    editor
                                                                        .royalties[
                                                                        row
                                                                            .user_id
                                                                    ]?.[type] ??
                                                                    '0'
                                                                }
                                                                onChange={(e) =>
                                                                    setEditor({
                                                                        ...editor,
                                                                        royalties:
                                                                            {
                                                                                ...editor.royalties,
                                                                                [row.user_id]:
                                                                                    {
                                                                                        ...editor
                                                                                            .royalties[
                                                                                            row
                                                                                                .user_id
                                                                                        ],
                                                                                        [type]: e
                                                                                            .target
                                                                                            .value,
                                                                                    },
                                                                            },
                                                                    })
                                                                }
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </fieldset>

                            <MouContentFields
                                value={editor}
                                onChange={(next) =>
                                    setEditor({ ...editor, ...next })
                                }
                            />

                            {editor.distribution_mode === 'one' && (
                                <label className="flex flex-col gap-1 text-sm">
                                    <span className="font-semibold text-oxford-navy-900">
                                        Hak distribusi terpilih
                                    </span>
                                    <span className="text-xs text-oxford-navy-900/60">
                                        {current.type === 'chapter'
                                            ? 'Book Chapter: ditetapkan admin.'
                                            : 'Paket biasa: biasanya dipilih penulis pertama saat menandatangani.'}
                                    </span>
                                    <select
                                        className="rounded-lg border border-oxford-navy-900/15 bg-white p-2"
                                        value={editor.choice}
                                        onChange={(e) =>
                                            setEditor({
                                                ...editor,
                                                choice: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">
                                            — belum dipilih —
                                        </option>
                                        {editor.distribution_options
                                            .filter((option) => option.key)
                                            .map((option) => (
                                                <option
                                                    key={option.key}
                                                    value={option.key}
                                                >
                                                    {option.name}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            )}

                            {signedCount > 0 && (
                                <label className="flex flex-row items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={editor.reset}
                                        onChange={(e) =>
                                            setEditor({
                                                ...editor,
                                                reset: e.target.checked,
                                            })
                                        }
                                    />
                                    {signedCount} penulis sudah menandatangani.
                                    Menyimpan perubahan akan membatalkan semua
                                    tanda tangan dan penulis diminta tanda
                                    tangan ulang.
                                </label>
                            )}

                            <div className="flex flex-row flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    disabled={
                                        isBusy ||
                                        (signedCount > 0 && !editor.reset)
                                    }
                                    onClick={saveEditor}
                                >
                                    {isBusy
                                        ? 'Menyimpan...'
                                        : 'Simpan isi judul ini'}
                                </Button>
                                <Button
                                    variant="outline2"
                                    onClick={() => setEditor(null)}
                                >
                                    Batal
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title={`MOU — ${current.title}`}
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
