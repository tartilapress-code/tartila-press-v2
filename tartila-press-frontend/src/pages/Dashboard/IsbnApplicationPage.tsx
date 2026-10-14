import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import SignaturePad from '@/components/isbn/SignaturePad';
import MouAgreeCheckbox from '@/components/mou/MouAgreeCheckbox';
import MouDocument from '@/components/mou/MouDocument';
import * as isbnApi from '@/data/isbn/isbnApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

export default function IsbnApplicationPage() {
    const { id } = useParams<{ id: string }>();

    const [application, setApplication] =
        useState<isbnApi.IsbnApplication | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [notice, setNotice] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mouAgreed, setMouAgreed] = useState<boolean>(false);
    const [distribution, setDistribution] = useState<string | null>(null);

    const load = useCallback(() => {
        return isbnApi
            .get(id ?? '')
            .then((response) => {
                setApplication(response.data);
            })
            .catch((caught) => setError(describeApiError(caught)))
            .finally(() => setIsLoading(false));
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!application) {
        return (
            <div className={cardClass}>
                <p className="text-red-600 text-sm">{error}</p>
                {error.includes('Data Pribadi') && (
                    <Link
                        to="/dashboard/data-pribadi"
                        className="text-forest-moss-700 text-sm underline self-start"
                    >
                        Lengkapi Data Pribadi
                    </Link>
                )}
            </div>
        );
    }

    const data = application.applicant_data;
    const locked = application.is_signed;
    // MOU yang ikut ditandatangani bersama surat ini (penulis pertama).
    const mou = application.mou ?? null;
    const signsMou =
        mou !== null &&
        mou.me !== null &&
        !mou.me.signed &&
        mou.me.sign_via === 'isbn';
    const choosesDistribution =
        signsMou && Boolean(mou?.me?.chooses_distribution);
    const mouReady =
        !signsMou ||
        (mouAgreed && (!choosesDistribution || distribution !== null));

    async function run(action: () => Promise<unknown>) {
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

    const preview = () =>
        run(async () => {
            const { blob } = await isbnApi.download(application.id, true);
            setPreviewUrl(URL.createObjectURL(blob));
        });

    const downloadPdf = () =>
        run(async () => {
            const { blob, filename } = await isbnApi.download(application.id);
            saveBlob(blob, filename ?? 'surat-isbn.pdf');
        });

    const sign = (signature: string) =>
        run(async () => {
            const response = await isbnApi.sign(
                application.id,
                signature,
                signsMou
                    ? {
                          mou_agreed: true,
                          ...(choosesDistribution && distribution
                              ? { distribution_choice: [distribution] }
                              : {}),
                      }
                    : undefined
            );
            setApplication(response.data);
            setNotice(response.message);
        });

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Terbitkan ISBN
                </h5>
                <p className="text-oxford-navy-900/80 text-sm">
                    Surat permohonan ISBN dan surat pernyataan keaslian karya
                    sudah terisi otomatis. Tinjau, lalu tanda tangani sebagai{' '}
                    {application.signer_role.toLowerCase()}. Penanggung jawab
                    penerbit kemudian membubuhkan tanda tangan dan stempel.
                </p>

                <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-oxford-navy-900/60">Nomor surat</dt>
                    <dd className="text-oxford-navy-900">
                        {application.letter_number}
                    </dd>
                    <dt className="text-oxford-navy-900/60">Judul</dt>
                    <dd className="text-oxford-navy-900">
                        {application.title}
                    </dd>
                    <dt className="text-oxford-navy-900/60">Kepengarangan</dt>
                    <dd className="text-oxford-navy-900">
                        {application.authors_text}
                    </dd>
                    <dt className="text-oxford-navy-900/60">
                        Penanda tangan ({application.signer_role.toLowerCase()})
                    </dt>
                    <dd className="text-oxford-navy-900">
                        {data.name}
                        <br />
                        NIK {data.nik} • {data.phone}
                        <br />
                        {data.address}
                    </dd>
                </dl>
                {!locked && (
                    <p className="text-oxford-navy-900/60 text-xs">
                        Data diambil dari Data Pribadi Anda. Salah?{' '}
                        <Link
                            to="/dashboard/data-pribadi"
                            className="text-forest-moss-700 underline"
                        >
                            Ubah Data Pribadi
                        </Link>{' '}
                        lalu muat ulang halaman ini.
                    </p>
                )}

                <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 text-sm">
                    <dt className="text-oxford-navy-900/60">
                        Link/akses ketersediaan buku
                    </dt>
                    <dd className="text-oxford-navy-900 break-all">
                        {application.availability_link ??
                            'Terisi otomatis dengan link buku setelah admin menerbitkan buku.'}
                    </dd>
                </dl>

                <div className="flex flex-row flex-wrap gap-2">
                    <Button
                        variant="outline2"
                        onClick={preview}
                        disabled={isBusy}
                    >
                        Tinjau surat
                    </Button>
                    <Button
                        variant="outline2"
                        onClick={downloadPdf}
                        disabled={isBusy}
                    >
                        Unduh surat (PDF)
                    </Button>
                </div>
                <p className="text-oxford-navy-900/60 text-xs">
                    Unduhan untuk {application.signer_role.toLowerCase()} tidak
                    memuat tanda tangan dan stempel penanggung jawab penerbit.
                </p>

                {error && <p className="text-red-600 text-sm">{error}</p>}
                {notice && (
                    <p className="text-forest-moss-700 text-sm">{notice}</p>
                )}
            </div>

            {mou && (
                <div className={cardClass}>
                    <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                        MOU Distribusi Buku
                    </h5>
                    <p className="text-oxford-navy-900/80 text-sm">
                        {signsMou
                            ? 'Sebagai penulis pertama, Anda menandatangani MOU distribusi buku sekalian dengan surat ini. Tinjau isinya'
                            : 'MOU distribusi buku untuk naskah ini'}
                        {choosesDistribution
                            ? ', pilih hak distribusi, lalu centang pernyataan di bawah.'
                            : signsMou
                              ? ', lalu centang pernyataan di bawah.'
                              : `: ${mou.status_label.toLowerCase()}.`}{' '}
                        Penulis lain menandatangani MOU dari menu Royalti Saya.
                    </p>
                    <MouDocument
                        mou={mou}
                        choice={distribution}
                        onChoiceChange={
                            choosesDistribution ? setDistribution : undefined
                        }
                    />
                    {signsMou && !locked && (
                        <MouAgreeCheckbox
                            checked={mouAgreed}
                            onChange={setMouAgreed}
                        />
                    )}
                </div>
            )}

            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                    Tanda tangan
                </h5>
                {locked ? (
                    <p className="text-forest-moss-700 text-sm">
                        Sudah ditandatangani{' '}
                        {application.signed_at &&
                            new Date(application.signed_at).toLocaleString(
                                'id-ID'
                            )}
                        .{' '}
                        {application.status === 'processed'
                            ? 'Penanggung jawab penerbit sudah memproses surat ini.'
                            : 'Menunggu tanda tangan dan stempel dari penanggung jawab.'}
                    </p>
                ) : (
                    <>
                        <p className="text-oxford-navy-900/70 text-sm">
                            Bubuhkan tanda tangan Anda di kotak berikut (gunakan
                            mouse atau jari). Setelah ditandatangani, surat
                            tidak bisa diubah lagi.
                        </p>
                        {signsMou && !mouReady && (
                            <p className="text-amber-700 text-sm">
                                {choosesDistribution && distribution === null
                                    ? 'Pilih hak distribusi dan centang pernyataan MOU di atas dulu.'
                                    : 'Centang pernyataan MOU di atas dulu.'}
                            </p>
                        )}
                        <SignaturePad
                            onSave={sign}
                            isSaving={isBusy}
                            disabled={!mouReady}
                            label={
                                signsMou
                                    ? 'Tanda tangani surat & MOU'
                                    : 'Tanda tangani surat'
                            }
                        />
                    </>
                )}
            </div>

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title="Surat permohonan ISBN"
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
