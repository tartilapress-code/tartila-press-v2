import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import MouContentFields, {
    type MouContentDraft,
} from '@/components/mou/MouContentFields';
import * as mouApi from '@/data/mou/mouApi';
import { describeApiError } from '@/lib/apiErrors';

const TABS: { key: mouApi.MouType; label: string; hint: string }[] = [
    {
        key: 'regular',
        label: 'Paket biasa',
        hint: 'Ditandatangani penulis pertama bersama surat ISBN, penulis lain dari Royalti Saya.',
    },
    {
        key: 'chapter',
        label: 'Book Chapter',
        hint: 'Disetujui tiap penulis bab saat menyetujui naskah akhir (naskah gabungan).',
    },
];

const fieldClass =
    'w-28 rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

type Draft = MouContentDraft & {
    physical_royalty: number | string;
    ebook_royalty: number | string;
    coauthor_royalty: number | string;
};

function toDraft(template: mouApi.MouTemplate): Draft {
    return {
        title: template.title,
        opening: template.opening,
        distribution_options: template.distribution_options,
        distribution_mode: template.distribution_mode,
        first_party_terms: template.first_party_terms,
        second_party_terms: template.second_party_terms,
        closing_terms: template.closing_terms,
        contact_note: template.contact_note,
        physical_royalty: template.physical_royalty,
        ebook_royalty: template.ebook_royalty,
        coauthor_royalty: template.coauthor_royalty ?? 5,
    };
}

/** Admin: template MOU distribusi buku per kategori paket. */
export default function MouTemplatePage() {
    const [category, setCategory] = useState<mouApi.MouType>('regular');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        mouApi
            .adminTemplate(category)
            .then((response) => {
                if (active) setDraft(toDraft(response.data));
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
    }, [category]);

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

    const save = () =>
        run(async () => {
            if (!draft) return;
            const response = await mouApi.adminSaveTemplate(category, {
                ...draft,
                physical_royalty: Number(draft.physical_royalty),
                ebook_royalty: Number(draft.ebook_royalty),
                coauthor_royalty: Number(draft.coauthor_royalty),
            });
            setDraft(toDraft(response.data));

            return response.message;
        });

    const reset = () =>
        run(async () => {
            if (
                !window.confirm(
                    'Kembalikan template ini ke isi bawaan? Isian Anda akan diganti.'
                )
            ) {
                return;
            }
            const response = await mouApi.adminResetTemplate(category);
            setDraft(toDraft(response.data));

            return response.message;
        });

    const preview = () =>
        run(async () => {
            const { blob } = await mouApi.adminPreviewTemplate(category);
            setPreviewUrl(URL.createObjectURL(blob));
        });

    const tab = TABS.find((item) => item.key === category)!;

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Template MOU Distribusi Buku
                </h5>
                <p className="text-sm text-oxford-navy-900/75">
                    Isi utama MOU per kategori paket. Perubahan{' '}
                    <strong>berlaku maju</strong>: hanya untuk MOU yang belum
                    ditandatangani siapa pun. MOU yang sudah ditandatangani dan
                    bermeterai tidak berubah. Isi MOU satu judul bisa
                    disesuaikan di{' '}
                    <Link
                        to="/admin/mou"
                        className="text-forest-moss-700 underline"
                    >
                        MOU Distribusi
                    </Link>
                    . Tanda tangan, stempel dan kop penerbit memakai{' '}
                    <Link
                        to="/admin/isbn-settings"
                        className="text-forest-moss-700 underline"
                    >
                        Template Surat ISBN
                    </Link>
                    .
                </p>
            </div>

            <div role="tablist" className="flex flex-row gap-2">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={category === item.key}
                        onClick={() => {
                            if (item.key === category) return;
                            setDraft(null);
                            setCategory(item.key);
                        }}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold hover:cursor-pointer ${category === item.key ? 'bg-oxford-navy-700 text-white' : 'bg-forest-moss-50 text-oxford-navy-800 ring-1 ring-forest-moss-200'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-oxford-navy-900/65">{tab.hint}</p>

            {!draft ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : (
                <>
                    <fieldset className="flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3">
                        <legend className="text-sm font-semibold text-oxford-navy-900">
                            Royalti maksimal per judul
                        </legend>
                        <p className="text-xs text-oxford-navy-900/65">
                            Total untuk satu judul; bila penulis lebih dari satu
                            dibagi rata (Book Chapter: per bab yang ditulis).
                            Jenis yang dipakai mengikuti layanan ISBN paket
                            (cetak → buku fisik, elektronik → ebook).
                        </p>
                        <div className="flex flex-row flex-wrap gap-6 text-sm text-oxford-navy-900">
                            <label className="flex flex-row items-center gap-2">
                                Royalti buku fisik
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    className={fieldClass}
                                    value={draft.physical_royalty}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            physical_royalty: e.target.value,
                                        })
                                    }
                                />
                                %
                            </label>
                            <label className="flex flex-row items-center gap-2">
                                Royalti ebook
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    className={fieldClass}
                                    value={draft.ebook_royalty}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            ebook_royalty: e.target.value,
                                        })
                                    }
                                />
                                %
                            </label>
                            {category === 'regular' && (
                                <label className="flex flex-row items-center gap-2">
                                    Royalti tetap co-author
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.01"
                                        className={fieldClass}
                                        value={draft.coauthor_royalty}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                coauthor_royalty:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                    %
                                </label>
                            )}
                        </div>
                        {category === 'regular' && (
                            <p className="text-xs text-oxford-navy-900/65">
                                Layanan co-author: co-author menjadi penulis
                                terakhir dengan jatah tetap ini untuk buku fisik
                                maupun ebook (sesuai layanan ISBN), di luar
                                pembagian rata royalti penulis lain.
                            </p>
                        )}
                    </fieldset>

                    <MouContentFields
                        value={draft}
                        onChange={(next) => setDraft({ ...draft, ...next })}
                    />

                    <div className="flex flex-row flex-wrap gap-2">
                        <Button
                            variant="primary"
                            onClick={save}
                            disabled={isBusy}
                        >
                            {isBusy ? 'Menyimpan...' : 'Simpan template'}
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={preview}
                            disabled={isBusy}
                        >
                            Pratinjau PDF (tersimpan)
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={reset}
                            disabled={isBusy}
                        >
                            Kembalikan isi bawaan
                        </Button>
                    </div>
                </>
            )}

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title={`Pratinjau MOU — ${tab.label}`}
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
