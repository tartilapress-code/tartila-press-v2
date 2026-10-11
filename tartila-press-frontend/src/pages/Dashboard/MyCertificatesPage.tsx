import { useEffect, useState } from 'react';
import { RiAwardLine } from '@remixicon/react';
import Button from '@/components/Button/Button';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as certificateApi from '@/data/certificate/certificateApi';
import * as hkiApi from '@/data/hki/hkiApi';
import { saveBlob } from '@/lib/download';
import type {
    CertificateCategory,
    MyCertificate,
} from '@/data/certificate/certificateApi';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';
import { describeApiError } from '@/lib/apiErrors';
import { EVENT_DATE } from '@/lib/eventTime';

const categories: {
    key: CertificateCategory;
    title: string;
    tab: string;
}[] = [
    { key: 'event', title: 'Sertifikat Event', tab: 'Event' },
    { key: 'author', title: 'Sertifikat Penulis', tab: 'Penulis' },
    { key: 'editor', title: 'Sertifikat Editor', tab: 'Editor' },
];

const dateFormatter = new Intl.DateTimeFormat('id-ID', EVENT_DATE);

export default function MyCertificatesPage() {
    const [certificates, setCertificates] = useState<MyCertificate[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string>('');
    const [filter, setFilter] = useState<'all' | CertificateCategory | 'hki'>(
        'all'
    );
    // Sertifikat HKI karya yang ditulis user (diunggah admin).
    const [hkiCertificates, setHkiCertificates] = useState<
        hkiApi.MyHkiCertificate[]
    >([]);
    const [hkiBusyId, setHkiBusyId] = useState<number | null>(null);
    const [hkiError, setHkiError] = useState<string>('');
    const [viewer, setViewer] = useState<{ url: string; title: string } | null>(
        null
    );

    const { busyId, error, download, preview } = useCertificateDownload();

    useEffect(() => {
        certificateApi
            .myCertificates()
            .then((response) => setCertificates(response.data))
            .catch((failure) =>
                setLoadError(
                    describeApiError(failure, 'Sertifikat tidak bisa dimuat.')
                )
            )
            .finally(() => setIsLoading(false));

        hkiApi
            .mine()
            .then((response) => setHkiCertificates(response.data))
            .catch(() => setHkiCertificates([]));
    }, []);

    async function openHki(
        certificate: hkiApi.MyHkiCertificate,
        inline: boolean
    ) {
        setHkiBusyId(certificate.id);
        setHkiError('');

        try {
            const { blob, filename } = await hkiApi.myCertificateFile(
                certificate.id,
                inline
            );

            if (inline) {
                setViewer({
                    url: URL.createObjectURL(blob),
                    title: `Sertifikat HKI — ${certificate.title}`,
                });
            } else {
                saveBlob(blob, filename ?? 'sertifikat-hki');
            }
        } catch (failure) {
            setHkiError(describeApiError(failure));
        } finally {
            setHkiBusyId(null);
        }
    }

    async function handleView(certificate: MyCertificate) {
        const url = await preview(certificate.id);

        if (url) {
            setViewer({ url, title: certificate.title });
        }
    }

    function closeViewer() {
        if (viewer) {
            URL.revokeObjectURL(viewer.url);
        }

        setViewer(null);
    }

    const visibleCategories = categories.filter(
        (category) =>
            (filter === 'all' || filter === category.key) &&
            certificates.some((item) => item.category === category.key)
    );

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Sertifikat Saya
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Semua sertifikat Anda bisa diunduh kapan saja.
                </p>
            </div>

            {loadError && (
                <p role="alert" className="text-red-600 text-sm">
                    {loadError}
                </p>
            )}
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            {hkiError && (
                <p role="alert" className="text-red-600 text-sm">
                    {hkiError}
                </p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : certificates.length === 0 && hkiCertificates.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada sertifikat. Sertifikat event muncul setelah Anda
                    mengisi absensi event yang diikuti; sertifikat penulis dan
                    editor muncul otomatis begitu buku Anda terbit (sudah punya
                    ISBN dan tanggal terbit).
                </p>
            ) : (
                <>
                    <div
                        role="group"
                        aria-label="Filter kategori sertifikat"
                        className="flex flex-row flex-wrap gap-2"
                    >
                        {[
                            {
                                key: 'all' as const,
                                label: 'Semua',
                                count:
                                    certificates.length +
                                    hkiCertificates.length,
                            },
                            ...categories
                                .map((category) => ({
                                    key: category.key,
                                    label: category.tab,
                                    count: certificates.filter(
                                        (item) => item.category === category.key
                                    ).length,
                                }))
                                .filter((tab) => tab.count > 0),
                            ...(hkiCertificates.length > 0
                                ? [
                                      {
                                          key: 'hki' as const,
                                          label: 'HKI',
                                          count: hkiCertificates.length,
                                      },
                                  ]
                                : []),
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                aria-pressed={filter === tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                                    filter === tab.key
                                        ? 'bg-oxford-navy-700 text-white'
                                        : 'bg-forest-moss-100 text-forest-moss-800 hover:bg-forest-moss-200'
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>

                    {visibleCategories.map((category) => (
                        <section
                            key={category.key}
                            className="flex flex-col gap-3"
                            aria-labelledby={`cert-${category.key}`}
                        >
                            <h6
                                id={`cert-${category.key}`}
                                className="font-display text-oxford-navy-700 text-lg font-bold"
                            >
                                {category.title}
                            </h6>

                            {certificates
                                .filter(
                                    (item) => item.category === category.key
                                )
                                .map((certificate) => (
                                    <div
                                        key={certificate.id}
                                        className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex flex-row items-start gap-3">
                                            <span className="bg-forest-moss-100 text-forest-moss-700 flex size-10 shrink-0 items-center justify-center rounded-full">
                                                <RiAwardLine
                                                    aria-hidden
                                                    className="size-5"
                                                />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-oxford-navy-900 font-semibold">
                                                    {certificate.title}
                                                </p>
                                                {certificate.subtitle && (
                                                    <p className="text-oxford-navy-900/70 text-sm">
                                                        {certificate.subtitle}
                                                    </p>
                                                )}
                                                <p className="text-oxford-navy-900/55 text-xs">
                                                    No. {certificate.number} ·
                                                    Diterbitkan{' '}
                                                    {dateFormatter.format(
                                                        new Date(
                                                            certificate.issued_at
                                                        )
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-row gap-2">
                                            <Button
                                                variant="primary"
                                                onClick={() =>
                                                    download(certificate.id)
                                                }
                                                disabled={
                                                    busyId === certificate.id
                                                }
                                            >
                                                {busyId === certificate.id
                                                    ? 'Menyiapkan...'
                                                    : 'Unduh PDF'}
                                            </Button>
                                            <Button
                                                variant="outline2"
                                                onClick={() =>
                                                    handleView(certificate)
                                                }
                                                disabled={
                                                    busyId === certificate.id
                                                }
                                            >
                                                Lihat
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                        </section>
                    ))}

                    {(filter === 'all' || filter === 'hki') &&
                        hkiCertificates.length > 0 && (
                            <section
                                className="flex flex-col gap-3"
                                aria-labelledby="cert-hki"
                            >
                                <h6
                                    id="cert-hki"
                                    className="font-display text-oxford-navy-700 text-lg font-bold"
                                >
                                    Sertifikat HKI
                                </h6>
                                {hkiCertificates.map((certificate) => (
                                    <div
                                        key={certificate.id}
                                        className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex flex-row items-start gap-3">
                                            <span className="bg-oxford-navy-700/10 text-oxford-navy-700 flex size-10 shrink-0 items-center justify-center rounded-full">
                                                <RiAwardLine
                                                    aria-hidden
                                                    className="size-5"
                                                />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-oxford-navy-900 font-semibold">
                                                    {certificate.title}
                                                </p>
                                                <p className="text-oxford-navy-900/70 text-sm">
                                                    Hak Kekayaan Intelektual
                                                    (Hak Cipta)
                                                </p>
                                                <p className="text-oxford-navy-900/55 text-xs">
                                                    {certificate.registration_number
                                                        ? `No. pencatatan ${certificate.registration_number}`
                                                        : 'Sertifikat HKI'}
                                                    {certificate.registered_at
                                                        ? ` · Terdaftar ${dateFormatter.format(new Date(certificate.registered_at))}`
                                                        : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-row gap-2">
                                            <Button
                                                variant="primary"
                                                onClick={() =>
                                                    openHki(certificate, false)
                                                }
                                                disabled={
                                                    hkiBusyId === certificate.id
                                                }
                                            >
                                                {hkiBusyId === certificate.id
                                                    ? 'Menyiapkan...'
                                                    : 'Unduh'}
                                            </Button>
                                            <Button
                                                variant="outline2"
                                                onClick={() =>
                                                    openHki(certificate, true)
                                                }
                                                disabled={
                                                    hkiBusyId === certificate.id
                                                }
                                            >
                                                Lihat
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}
                </>
            )}

            {viewer && (
                <PdfPreviewModal
                    url={viewer.url}
                    title={viewer.title}
                    onClose={closeViewer}
                />
            )}
        </div>
    );
}
