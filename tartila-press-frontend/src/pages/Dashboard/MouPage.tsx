import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import SignaturePad from '@/components/isbn/SignaturePad';
import MouAgreeCheckbox from '@/components/mou/MouAgreeCheckbox';
import MouDocument from '@/components/mou/MouDocument';
import * as mouApi from '@/data/mou/mouApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

/** MOU distribusi buku untuk penulis: tinjau, centang, tanda tangan, unduh. */
export default function MouPage() {
    const { id } = useParams<{ id: string }>();
    const [mou, setMou] = useState<mouApi.Mou | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [agreed, setAgreed] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [notice, setNotice] = useState<string>('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const load = useCallback(() => {
        return mouApi
            .get(id ?? '')
            .then((response) => setMou(response.data))
            .catch((caught) => setError(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!mou) {
        return (
            <div className={cardClass}>
                <p className="text-sm text-red-600">{error}</p>
            </div>
        );
    }

    async function run(action: () => Promise<void>) {
        setIsBusy(true);
        setError('');
        setNotice('');

        try {
            await action();
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    const current = mou;
    const me = current.me;
    const canSignHere =
        me !== null &&
        !me.signed &&
        me.sign_via === 'direct' &&
        me.blocked_reason === null;

    const preview = () =>
        run(async () => {
            const { blob } = await mouApi.pdf(current.id, true);
            setPreviewUrl(URL.createObjectURL(blob));
        });

    const download = () =>
        run(async () => {
            const { blob, filename } = await mouApi.pdf(current.id);
            saveBlob(blob, filename ?? 'mou.pdf');
        });

    const sign = (signature: string) =>
        run(async () => {
            const response = await mouApi.sign(current.id, signature);
            setMou(response.data);
            setNotice(response.message);
        });

    return (
        <div className="flex max-w-4xl flex-col gap-6">
            <div className={cardClass}>
                <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                        MOU Distribusi Buku
                    </h5>
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${mouApi.STATUS_CLASS[current.status]}`}
                    >
                        {current.status_label}
                    </span>
                </div>
                <p className="text-sm text-oxford-navy-900/80">
                    Perjanjian distribusi buku <strong>{current.title}</strong>.
                    Semua penulis menandatangani sebelum buku diterbitkan;
                    setelah itu penerbit menandatangani, memberi stempel dan
                    meterai, lalu PDF bermeterai bisa dibuka di sini dan di
                    Royalti Saya.
                </p>
                <div className="flex flex-row flex-wrap gap-2">
                    <Button
                        variant="outline2"
                        onClick={preview}
                        disabled={isBusy}
                    >
                        {current.has_final
                            ? 'Lihat MOU bermeterai'
                            : 'Pratinjau PDF'}
                    </Button>
                    <Button
                        variant="outline2"
                        onClick={download}
                        disabled={isBusy}
                    >
                        Unduh PDF
                    </Button>
                </div>
                {current.addenda.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-oxford-navy-900">
                            Adendum
                        </p>
                        {current.addenda.map((addendum) => (
                            <button
                                key={addendum.id}
                                type="button"
                                className="self-start text-sm text-forest-moss-700 underline hover:cursor-pointer"
                                onClick={() =>
                                    run(async () => {
                                        const { blob } =
                                            await mouApi.addendumFile(
                                                current.id,
                                                addendum.id,
                                                true
                                            );
                                        setPreviewUrl(
                                            URL.createObjectURL(blob)
                                        );
                                    })
                                }
                            >
                                {addendum.title}
                                {addendum.note ? ` — ${addendum.note}` : ''}
                            </button>
                        ))}
                    </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                {notice && (
                    <p className="text-sm text-forest-moss-700">{notice}</p>
                )}
            </div>

            <MouDocument mou={current} />

            {me && (
                <div className={cardClass}>
                    <h5 className="font-display text-lg font-bold text-oxford-navy-700">
                        Tanda tangan Anda
                    </h5>
                    {me.signed ? (
                        <p className="text-sm text-forest-moss-700">
                            Anda sudah menandatangani MOU ini pada{' '}
                            {mouApi.formatSignedAt(me.signed_at)}.
                        </p>
                    ) : me.sign_via === 'isbn' ? (
                        <div className="flex flex-col gap-2 text-sm text-oxford-navy-900/80">
                            <p>
                                Sebagai penulis pertama, Anda menandatangani MOU
                                ini sekalian dengan surat permohonan ISBN.
                            </p>
                            {current.isbn_application_id ? (
                                <Link
                                    to={`/dashboard/isbn/${current.isbn_application_id}`}
                                    className="self-start rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600"
                                >
                                    Buka surat ISBN & MOU
                                </Link>
                            ) : (
                                current.manuscript_id && (
                                    <Link
                                        to={`/dashboard/naskah/${current.manuscript_id}`}
                                        className="self-start rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600"
                                    >
                                        Buka naskah → Ajukan ISBN
                                    </Link>
                                )
                            )}
                        </div>
                    ) : me.sign_via === 'final_review' ? (
                        <div className="flex flex-col gap-2 text-sm text-oxford-navy-900/80">
                            <p>
                                MOU Book Chapter disetujui saat Anda menyetujui
                                naskah akhir (naskah gabungan semua bab).
                            </p>
                            {current.compilation_manuscript_id && (
                                <Link
                                    to={`/dashboard/naskah/${current.compilation_manuscript_id}`}
                                    className="self-start rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600"
                                >
                                    Buka naskah akhir
                                </Link>
                            )}
                        </div>
                    ) : me.blocked_reason ? (
                        <p className="text-sm text-amber-700">
                            {me.blocked_reason}
                        </p>
                    ) : null}

                    {canSignHere && (
                        <>
                            <MouAgreeCheckbox
                                checked={agreed}
                                onChange={setAgreed}
                            />
                            <SignaturePad
                                onSave={sign}
                                isSaving={isBusy}
                                disabled={!agreed}
                                label="Tanda tangani MOU"
                            />
                        </>
                    )}
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
