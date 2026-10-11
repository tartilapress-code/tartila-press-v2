import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PublicationTimeline from '@/components/publication/PublicationTimeline';
import * as publicationApi from '@/data/publication/publicationApi';
import { describeApiError } from '@/lib/apiErrors';

const fieldClass =
    'w-full rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const PHYSICAL_OPTIONS: {
    value: '' | publicationApi.PhysicalStep;
    label: string;
}[] = [
    { value: '', label: 'Belum dicetak' },
    { value: 'printed', label: 'Buku dicetak' },
    { value: 'shipped', label: 'Buku dikirim' },
    { value: 'delivered', label: 'Buku sampai' },
];

function currentPhysical(
    progress: publicationApi.PublicationProgress
): '' | publicationApi.PhysicalStep {
    const steps =
        progress.sections.find((section) => section.key === 'physical')
            ?.steps ?? [];
    const done = steps.filter((step) => step.state === 'done');

    return (done.at(-1)?.key as publicationApi.PhysicalStep | undefined) ?? '';
}

/**
 * Admin (Terbitkan Naskah): proses penerbitan satu surat ISBN — resi
 * pengajuan, ISBN ditolak (catatan untuk penulis) / terbit, buku fisik.
 * Status HAKI diubah di halaman HKI.
 */
export default function PublicationProcessPanel({
    applicationId,
}: {
    applicationId: number;
}) {
    const [progress, setProgress] =
        useState<publicationApi.PublicationProgress | null>(null);
    const [receipt, setReceipt] = useState<string>('');
    const [isbn, setIsbn] = useState<string>('');
    const [rejectNote, setRejectNote] = useState<string>('');
    const [physicalStep, setPhysicalStep] = useState<
        '' | publicationApi.PhysicalStep
    >('');
    const [physicalNote, setPhysicalNote] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    function apply(next: publicationApi.PublicationProgress) {
        setProgress(next);
        const submitted = next.sections
            .find((section) => section.key === 'isbn')
            ?.steps.find((step) => step.key === 'isbn_submitted');
        const published = next.sections
            .find((section) => section.key === 'isbn')
            ?.steps.find((step) => step.key === 'isbn_published');
        setReceipt(submitted?.receipt ?? '');
        setIsbn(published?.isbn ?? '');
        setPhysicalStep(currentPhysical(next));
        setPhysicalNote(
            next.sections.find((section) => section.key === 'physical')?.note ??
                ''
        );
    }

    useEffect(() => {
        let active = true;

        publicationApi
            .adminProgress(applicationId)
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
    }, [applicationId]);

    async function run(
        task: () => Promise<{ data: publicationApi.PublicationProgress }>,
        done: string
    ) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            apply((await task()).data);
            setMessage(done);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    if (!progress) {
        return message ? (
            <p className="text-xs text-red-600">{message}</p>
        ) : (
            <p className="text-oxford-navy-900/60 text-xs">
                Memuat proses penerbitan...
            </p>
        );
    }

    const isbnSteps =
        progress.sections.find((section) => section.key === 'isbn')?.steps ??
        [];
    const letterDone = isbnSteps[0]?.state === 'done';
    const isbnPublished =
        isbnSteps.find((step) => step.key === 'isbn_published')?.state ===
        'done';
    const isbnSubmitted =
        isbnSteps.find((step) => step.key === 'isbn_submitted')?.state ===
        'done';
    const hkiIncluded = progress.includes.hki;
    const physicalIncluded = progress.includes.physical;
    const override = progress.includes.physical_override;

    return (
        <div className="flex flex-col gap-4 rounded-lg bg-white p-4 ring-1 ring-forest-moss-100">
            <p className="text-oxford-navy-900 text-sm font-semibold">
                Proses penerbitan (tampil di Naskah Saya penulis)
            </p>

            <PublicationTimeline progress={progress} />

            {/* ISBN */}
            <div className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3">
                <p className="text-oxford-navy-900 text-sm font-semibold">
                    Pengajuan ISBN
                </p>
                {!letterDone ? (
                    <p className="text-amber-700 text-xs">
                        Surat keaslian karya belum ditandatangani.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor={`receipt-${applicationId}`}
                                className="text-oxford-navy-900/70 text-xs"
                            >
                                Resi pengajuan ISBN dari Perpusnas
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    id={`receipt-${applicationId}`}
                                    className={fieldClass}
                                    value={receipt}
                                    maxLength={100}
                                    placeholder="Nomor resi"
                                    onChange={(e) => setReceipt(e.target.value)}
                                />
                                <Button
                                    variant="primary"
                                    className="shrink-0"
                                    disabled={isBusy || receipt.trim() === ''}
                                    onClick={() =>
                                        run(
                                            () =>
                                                publicationApi.adminIsbn(
                                                    applicationId,
                                                    {
                                                        action: 'submit',
                                                        receipt: receipt.trim(),
                                                    }
                                                ),
                                            'Resi ISBN disimpan; penulis bisa melacaknya.'
                                        )
                                    }
                                >
                                    {isbnSubmitted && !isbnPublished
                                        ? 'Simpan resi'
                                        : 'Ajukan ISBN'}
                                </Button>
                            </div>
                        </div>

                        {isbnSubmitted && !isbnPublished && (
                            <div className="flex flex-col gap-1">
                                <label
                                    htmlFor={`reject-${applicationId}`}
                                    className="text-oxford-navy-900/70 text-xs"
                                >
                                    ISBN ditolak — catatan untuk penulis
                                </label>
                                <textarea
                                    id={`reject-${applicationId}`}
                                    rows={2}
                                    className={fieldClass}
                                    value={rejectNote}
                                    maxLength={2000}
                                    placeholder="Alasan penolakan dan yang perlu diperbaiki"
                                    onChange={(e) =>
                                        setRejectNote(e.target.value)
                                    }
                                />
                                <Button
                                    variant="outline2"
                                    className="self-start"
                                    disabled={
                                        isBusy || rejectNote.trim() === ''
                                    }
                                    onClick={() =>
                                        run(async () => {
                                            const result =
                                                await publicationApi.adminIsbn(
                                                    applicationId,
                                                    {
                                                        action: 'reject',
                                                        note: rejectNote.trim(),
                                                    }
                                                );
                                            setRejectNote('');
                                            return result;
                                        }, 'ISBN ditandai ditolak; catatan dikirim ke penulis.')
                                    }
                                >
                                    Tandai ISBN ditolak
                                </Button>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor={`isbn-${applicationId}`}
                                className="text-oxford-navy-900/70 text-xs"
                            >
                                Nomor ISBN yang terbit (ikut tersimpan di data
                                buku)
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    id={`isbn-${applicationId}`}
                                    className={fieldClass}
                                    value={isbn}
                                    maxLength={40}
                                    placeholder="978-623-..."
                                    onChange={(e) => setIsbn(e.target.value)}
                                />
                                <Button
                                    variant="primary"
                                    className="shrink-0"
                                    disabled={isBusy || isbn.trim() === ''}
                                    onClick={() =>
                                        run(
                                            () =>
                                                publicationApi.adminIsbn(
                                                    applicationId,
                                                    {
                                                        action: 'publish',
                                                        isbn: isbn.trim(),
                                                    }
                                                ),
                                            'ISBN terbit dicatat.'
                                        )
                                    }
                                >
                                    {isbnPublished
                                        ? 'Simpan ISBN'
                                        : 'Tandai ISBN terbit'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* HAKI */}
            <div className="flex flex-col gap-1 rounded-lg bg-forest-moss-50 p-3">
                <p className="text-oxford-navy-900 text-sm font-semibold">
                    HAKI
                </p>
                <p className="text-oxford-navy-900/70 text-xs">
                    {hkiIncluded ? (
                        <>
                            Status pengajuan dan sertifikat HAKI diubah di
                            halaman{' '}
                            <Link
                                to="/admin/hki"
                                className="font-semibold text-forest-moss-700 hover:underline"
                            >
                                HKI
                            </Link>
                            ; perubahannya otomatis masuk riwayat ini.
                        </>
                    ) : (
                        'Tidak termasuk paket (diatur di rincian Keuangan bila salah).'
                    )}
                </p>
            </div>

            {/* Buku fisik */}
            <div className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-oxford-navy-900 text-sm font-semibold">
                        Buku fisik
                    </p>
                    <label className="flex flex-row items-center gap-2 text-xs text-oxford-navy-900/70">
                        Termasuk paket?
                        <select
                            className="rounded-lg border border-oxford-navy-900/15 bg-white p-1.5 text-xs text-oxford-navy-900"
                            value={
                                override === null
                                    ? 'auto'
                                    : override
                                      ? 'yes'
                                      : 'no'
                            }
                            disabled={isBusy}
                            onChange={(e) =>
                                run(
                                    () =>
                                        publicationApi.adminSettings(
                                            applicationId,
                                            {
                                                includes_physical:
                                                    e.target.value === 'auto'
                                                        ? null
                                                        : e.target.value ===
                                                          'yes',
                                            }
                                        ),
                                    'Pengaturan buku fisik disimpan.'
                                )
                            }
                        >
                            <option value="auto">
                                Ikuti paket (
                                {progress.includes.physical_auto
                                    ? 'ya'
                                    : 'tidak'}
                                )
                            </option>
                            <option value="yes">Ya</option>
                            <option value="no">Tidak</option>
                        </select>
                    </label>
                </div>

                {physicalIncluded ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                                aria-label="Tahap buku fisik"
                                className={`${fieldClass} sm:w-48`}
                                value={physicalStep}
                                onChange={(e) =>
                                    setPhysicalStep(
                                        e.target.value as
                                            '' | publicationApi.PhysicalStep
                                    )
                                }
                            >
                                {PHYSICAL_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                aria-label="Keterangan pengiriman"
                                className={fieldClass}
                                value={physicalNote}
                                maxLength={2000}
                                placeholder="Keterangan (mis. kurir & no. resi pengiriman)"
                                onChange={(e) =>
                                    setPhysicalNote(e.target.value)
                                }
                            />
                            <Button
                                variant="primary"
                                className="shrink-0"
                                disabled={isBusy}
                                onClick={() =>
                                    run(
                                        () =>
                                            publicationApi.adminPhysical(
                                                applicationId,
                                                {
                                                    step: physicalStep || null,
                                                    note: physicalNote.trim(),
                                                }
                                            ),
                                        'Tahap buku fisik disimpan.'
                                    )
                                }
                            >
                                Simpan
                            </Button>
                        </div>
                        <p className="text-oxford-navy-900/60 text-xs">
                            Penulis juga bisa menandai "Buku sudah sampai"
                            setelah buku dikirim.
                        </p>
                    </div>
                ) : (
                    <p className="text-oxford-navy-900/70 text-xs">
                        Tidak termasuk paket: proses selesai tanpa tahap buku
                        fisik.
                    </p>
                )}
            </div>

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
