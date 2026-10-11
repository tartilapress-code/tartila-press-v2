import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type {
    PublicationProgress,
    PublicationSection,
    PublicationStep,
    StepState,
} from '@/data/publication/publicationApi';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function formatProcessDate(value: string | null): string {
    return value ? dateFormatter.format(new Date(value)) : '';
}

const DOT: Record<StepState, string> = {
    done: 'bg-forest-moss-600 text-white ring-forest-moss-600',
    current: 'bg-white text-oxford-navy-700 ring-oxford-navy-700',
    pending: 'bg-white text-oxford-navy-900/40 ring-oxford-navy-900/20',
    rejected: 'bg-red-600 text-white ring-red-600',
};

function StepIcon({ state, index }: { state: StepState; index: number }) {
    return (
        <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ${DOT[state]}`}
        >
            {state === 'done' ? (
                <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
                    <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                    />
                </svg>
            ) : state === 'rejected' ? (
                '!'
            ) : (
                index + 1
            )}
        </span>
    );
}

const STATE_TEXT: Record<StepState, string> = {
    done: 'Selesai',
    current: 'Sedang berjalan',
    pending: 'Belum',
    rejected: 'Ditolak',
};

function ReceiptBox({ step }: { step: PublicationStep }) {
    const [copied, setCopied] = useState<boolean>(false);

    if (!step.receipt) return null;

    async function copy() {
        try {
            await navigator.clipboard.writeText(step.receipt ?? '');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-forest-moss-50 p-3 ring-1 ring-forest-moss-100">
            <div className="flex flex-row flex-wrap items-center gap-2">
                <span className="text-oxford-navy-900/70 text-xs">
                    Resi ISBN
                </span>
                <code className="rounded bg-white px-2 py-1 text-sm font-semibold text-oxford-navy-900 ring-1 ring-forest-moss-200 break-all">
                    {step.receipt}
                </code>
                <button
                    type="button"
                    onClick={copy}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-forest-moss-700 ring-1 ring-forest-moss-300 hover:bg-white hover:cursor-pointer"
                >
                    {copied ? 'Tersalin ✓' : 'Salin resi'}
                </button>
                <a
                    href={step.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-oxford-navy-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-oxford-navy-600"
                >
                    Lacak di Perpusnas ↗
                </a>
            </div>
            <p className="text-oxford-navy-900/70 text-xs">
                Salin resi, lalu tempelkan di halaman pelacakan Perpusnas untuk
                melacak proses terbit ISBN.
            </p>
        </div>
    );
}

function StepDetail({
    step,
    sectionNote,
}: {
    step: PublicationStep;
    sectionNote?: string | null;
}) {
    return (
        <>
            {step.key === 'isbn_submitted' && <ReceiptBox step={step} />}
            {step.key === 'isbn_rejected' && step.note && (
                <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200 whitespace-pre-line">
                    <span className="font-semibold">Catatan admin: </span>
                    {step.note}
                </p>
            )}
            {step.key === 'isbn_published' && step.isbn && (
                <p className="mt-1 text-sm text-oxford-navy-900">
                    ISBN: <span className="font-semibold">{step.isbn}</span>
                </p>
            )}
            {step.key === 'hki_submitted' && step.application_number && (
                <p className="mt-1 text-xs text-oxford-navy-900/70">
                    Nomor permohonan: {step.application_number}
                </p>
            )}
            {step.key === 'hki_registered' && step.state === 'done' && (
                <p className="mt-1 text-xs text-oxford-navy-900/70">
                    {step.registration_number &&
                        `Nomor pencatatan: ${step.registration_number}. `}
                    {step.has_certificate && (
                        <Link
                            to="/dashboard/sertifikat-saya"
                            className="font-semibold text-forest-moss-700 hover:underline"
                        >
                            Lihat sertifikat HAKI →
                        </Link>
                    )}
                </p>
            )}
            {step.key === 'shipped' && step.state === 'done' && sectionNote && (
                <p className="mt-1 text-xs text-oxford-navy-900/70 whitespace-pre-line">
                    Keterangan pengiriman: {sectionNote}
                </p>
            )}
        </>
    );
}

function Section({ section }: { section: PublicationSection }) {
    return (
        <div
            className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ${section.key === 'isbn' ? 'md:col-span-2 2xl:col-span-1' : ''} ${section.included ? 'bg-white ring-forest-moss-100' : 'bg-oxford-navy-900/[0.03] ring-oxford-navy-900/10'}`}
        >
            <div className="flex flex-row items-center justify-between gap-2">
                <p className="font-display text-oxford-navy-700 font-bold">
                    {section.title}
                </p>
                {!section.included && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-oxford-navy-900/70 ring-1 ring-oxford-navy-900/15">
                        Tidak termasuk paket
                    </span>
                )}
            </div>

            {section.included ? (
                <ol className="flex flex-col">
                    {section.steps.map((step, index) => (
                        <li key={step.key} className="flex flex-row gap-3">
                            <div className="flex flex-col items-center">
                                <StepIcon state={step.state} index={index} />
                                {index < section.steps.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className={`w-0.5 flex-1 min-h-4 ${step.state === 'done' ? 'bg-forest-moss-400' : 'bg-oxford-navy-900/15'}`}
                                    />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col pb-4">
                                <p
                                    className={`text-sm font-semibold ${step.state === 'pending' ? 'text-oxford-navy-900/55' : step.state === 'rejected' ? 'text-red-700' : 'text-oxford-navy-900'}`}
                                >
                                    {step.label}
                                    <span className="sr-only">
                                        {' '}
                                        ({STATE_TEXT[step.state]})
                                    </span>
                                </p>
                                {step.at && step.state !== 'pending' && (
                                    <p className="text-xs text-oxford-navy-900/60">
                                        {formatProcessDate(step.at)}
                                    </p>
                                )}
                                {step.state === 'current' && !step.at && (
                                    <p className="text-xs text-oxford-navy-700">
                                        Sedang berjalan
                                    </p>
                                )}
                                <StepDetail
                                    step={step}
                                    sectionNote={section.note}
                                />
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-xs text-oxford-navy-900/65">
                    {section.key === 'hki'
                        ? 'Paket Anda tidak memuat pengurusan HAKI.'
                        : 'Paket Anda tidak memuat cetak buku fisik.'}{' '}
                    Proses selesai setelah ISBN terbit
                    {section.key === 'hki' ? '' : ' (dan HAKI bila ada)'}.
                </p>
            )}
        </div>
    );
}

/**
 * Riwayat status proses penerbitan: tahap ISBN, HAKI dan buku fisik
 * (bagian yang tidak termasuk paket ditampilkan redup), lalu riwayat
 * kejadian berurutan waktu.
 */
export default function PublicationTimeline({
    progress,
    actions,
}: {
    progress: PublicationProgress;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4">
            <div
                className={`flex flex-row flex-wrap items-center gap-2 rounded-xl p-3 ring-1 ${progress.completed ? 'bg-forest-moss-50 ring-forest-moss-200' : 'bg-oxford-navy-900/[0.03] ring-oxford-navy-900/10'}`}
            >
                <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${progress.completed ? 'bg-forest-moss-600 text-white' : 'bg-oxford-navy-700 text-white'}`}
                >
                    {progress.completed ? 'Proses selesai' : 'Dalam proses'}
                </span>
                <span className="text-sm text-oxford-navy-900">
                    {progress.completed
                        ? `Semua tahap penerbitan selesai${progress.completed_at ? ` (${formatProcessDate(progress.completed_at)})` : ''}.`
                        : `Tahap saat ini: ${progress.current}`}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {progress.sections.map((section) => (
                    <Section key={section.key} section={section} />
                ))}
            </div>

            {actions}

            {progress.history.length > 0 && (
                <details className="rounded-xl bg-white p-4 ring-1 ring-forest-moss-100">
                    <summary className="cursor-pointer text-sm font-semibold text-oxford-navy-900">
                        Riwayat lengkap ({progress.history.length})
                    </summary>
                    <ul className="mt-3 flex flex-col divide-y divide-forest-moss-100">
                        {[...progress.history].reverse().map((row, index) => (
                            <li
                                key={`${row.stage}-${row.at}-${index}`}
                                className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"
                            >
                                <span className="w-40 shrink-0 text-xs text-oxford-navy-900/60">
                                    {formatProcessDate(row.at)}
                                </span>
                                <span className="text-sm text-oxford-navy-900">
                                    <span
                                        className={`font-semibold ${row.stage === 'isbn_rejected' ? 'text-red-700' : ''}`}
                                    >
                                        {row.label}
                                    </span>
                                    {row.note && (
                                        <span className="text-oxford-navy-900/70">
                                            {' '}
                                            — {row.note}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
