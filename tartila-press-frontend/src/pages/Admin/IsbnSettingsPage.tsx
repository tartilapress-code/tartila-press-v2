import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as isbnApi from '@/data/isbn/isbnApi';
import { describeApiError } from '@/lib/apiErrors';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';
const fieldClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm font-normal text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

type TextKey = Exclude<
    keyof isbnApi.IsbnSettings,
    'has_logo' | 'has_signature' | 'has_stamp'
>;

const SHORT_FIELDS: [TextKey, string][] = [
    ['publisher_name', 'Nama penerbit'],
    ['city', 'Kota surat'],
    ['website', 'Website'],
    ['email', 'Email'],
    ['responsible_name', 'Penanggung jawab / pimpinan penerbit'],
    ['admin_name', 'Admin'],
    ['letter_code', 'Kode nomor surat (mis. PISBN/TP)'],
    ['subject', 'Perihal'],
];

const LONG_FIELDS: [TextKey, string, number][] = [
    ['publisher_address', 'Alamat penerbit (kop & surat keaslian)', 2],
    ['recipient', 'Tujuan surat', 2],
    ['application_body', 'Surat permohonan — paragraf isi', 4],
    ['application_closing', 'Surat permohonan — penutup', 2],
    ['statement_body', 'Surat keaslian — kalimat pengantar penerbit', 2],
    ['statement_closing', 'Surat keaslian — penutup', 3],
];

const ASSETS: { kind: isbnApi.AssetKind; label: string; hint: string }[] = [
    {
        kind: 'logo',
        label: 'Logo kop surat',
        hint: 'Kosong = logo bawaan Tartila Press.',
    },
    {
        kind: 'signature',
        label: 'Tanda tangan penanggung jawab',
        hint: 'PNG transparan. Hanya dipakai pada unduhan admin.',
    },
    {
        kind: 'stamp',
        label: 'Stempel penerbit',
        hint: 'PNG transparan. Hanya dipakai pada unduhan admin.',
    },
];

export default function IsbnSettingsPage() {
    const [form, setForm] = useState<isbnApi.IsbnSettings | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});

    const loadThumbs = useCallback(async (settings: isbnApi.IsbnSettings) => {
        const next: Record<string, string> = {};

        for (const { kind } of ASSETS) {
            if (settings[`has_${kind}` as const]) {
                try {
                    const { blob } = await isbnApi.adminAsset(kind);
                    next[kind] = URL.createObjectURL(blob);
                } catch {
                    // gambar tidak terbaca: tanpa pratinjau kecil
                }
            }
        }

        setThumbs(next);
    }, []);

    const apply = useCallback(
        (settings: isbnApi.IsbnSettings) => {
            setForm(settings);
            loadThumbs(settings);
        },
        [loadThumbs]
    );

    useEffect(() => {
        isbnApi
            .adminSettings()
            .then((response) => apply(response.data))
            .catch((caught) => {
                setIsError(true);
                setMessage(describeApiError(caught));
            })
            .finally(() => setIsLoading(false));
    }, [apply]);

    if (isLoading || !form) {
        return (
            <p className="text-oxford-navy-900">
                {isLoading ? 'Memuat...' : message}
            </p>
        );
    }

    async function run(
        action: () => Promise<{ message?: string; data?: unknown }>
    ) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await action();
            setMessage(response.message ?? 'Berhasil.');

            if (response.data) {
                apply(response.data as isbnApi.IsbnSettings);
            }
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    const set = (key: TextKey, value: string) =>
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const save = () => run(() => isbnApi.adminSaveSettings(form));

    const preview = async () => {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            // Simpan dulu supaya pratinjau memakai teks terbaru.
            await isbnApi.adminSaveSettings(form);
            const { blob } = await isbnApi.adminPreview();
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Template Surat ISBN
                </h5>
                <p className="text-oxford-navy-900/80 text-sm">
                    Template bawaan mengikuti contoh &quot;Surat
                    Permohonan&quot;. Ubah teks atau gambar di bawah, lalu
                    simpan — semua surat berikutnya memakai template ini. Di
                    teks paragraf boleh memakai penanda <code>{'{judul}'}</code>
                    , <code>{'{penulis}'}</code>, <code>{'{penerbit}'}</code>,
                    dan <code>{'{penandatangan}'}</code> (penulis / editor).
                </p>

                {ASSETS.map(({ kind, label, hint }) => (
                    <div
                        key={kind}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl ring-1 ring-forest-moss-100 p-3"
                    >
                        <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-forest-moss-50">
                            {thumbs[kind] ? (
                                <img
                                    src={thumbs[kind]}
                                    alt={label}
                                    className="max-h-full max-w-full object-contain"
                                />
                            ) : (
                                <span className="text-oxford-navy-900/40 text-xs text-center">
                                    {kind === 'logo' ? 'Bawaan' : 'Belum ada'}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <p className="text-oxford-navy-900 text-sm font-semibold">
                                {label}
                            </p>
                            <p className="text-oxford-navy-900/60 text-xs">
                                {hint}
                            </p>
                            <div className="flex flex-row flex-wrap items-center gap-2">
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    aria-label={`Unggah ${label}`}
                                    disabled={isBusy}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';

                                        if (file) {
                                            run(() =>
                                                isbnApi.adminUploadAsset(
                                                    kind,
                                                    file
                                                )
                                            );
                                        }
                                    }}
                                    className="text-xs"
                                />
                                {form[`has_${kind}` as const] && (
                                    <button
                                        type="button"
                                        className="text-red-600 text-xs hover:cursor-pointer"
                                        onClick={() =>
                                            run(() =>
                                                isbnApi.adminDeleteAsset(kind)
                                            )
                                        }
                                    >
                                        Hapus
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={cardClass}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SHORT_FIELDS.map(([key, label]) => (
                        <label
                            key={key}
                            className="flex flex-col gap-1 text-xs text-oxford-navy-900/70"
                        >
                            {label}
                            <input
                                className={fieldClass}
                                value={(form[key] as string | null) ?? ''}
                                onChange={(e) => set(key, e.target.value)}
                            />
                        </label>
                    ))}
                </div>

                {LONG_FIELDS.map(([key, label, rows]) => (
                    <label
                        key={key}
                        className="flex flex-col gap-1 text-xs text-oxford-navy-900/70"
                    >
                        {label}
                        <textarea
                            rows={rows}
                            className={fieldClass}
                            value={(form[key] as string | null) ?? ''}
                            onChange={(e) => set(key, e.target.value)}
                        />
                    </label>
                ))}

                {message && (
                    <p
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}

                <div className="flex flex-row flex-wrap gap-2">
                    <Button variant="primary" onClick={save} disabled={isBusy}>
                        Simpan template
                    </Button>
                    <Button
                        variant="outline2"
                        onClick={preview}
                        disabled={isBusy}
                    >
                        Simpan & pratinjau
                    </Button>
                    <Button
                        variant="outline2"
                        disabled={isBusy}
                        onClick={() => {
                            if (
                                window.confirm(
                                    'Kembalikan semua teks ke surat bawaan? Gambar tidak berubah.'
                                )
                            ) {
                                run(() => isbnApi.adminResetSettings());
                            }
                        }}
                    >
                        Kembalikan ke bawaan
                    </Button>
                </div>
            </div>

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title="Pratinjau template surat ISBN"
                    onClose={() => {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }}
                />
            )}
        </div>
    );
}
