import { useState } from 'react';
import {
    DOCUMENT_LABEL,
    STATUS_LABEL,
    type DocumentKind,
    type PartnerBook,
    type PartnerStatus,
} from '@/data/partnerApi';
import { describeApiError } from '@/lib/apiErrors';
import { formatDateTime } from '@/lib/format';
import { saveBlob } from '@/lib/download';

const STATUS_CLASS: Record<PartnerStatus, string> = {
    draft: 'bg-oxford-navy-900/10 text-oxford-navy-800',
    submitted: 'bg-amber-100 text-amber-900',
    approved: 'bg-forest-moss-100 text-forest-moss-800',
    rejected: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: PartnerStatus }) {
    return (
        <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

const ACTION_LABEL: Record<string, string> = {
    submitted: 'Diajukan',
    resubmitted: 'Diajukan ulang',
    approved: 'Disetujui admin',
    rejected: 'Ditolak admin',
    reopened: 'Ditarik untuk revisi',
};

/** Ebook + tiga dokumen buku mitra dengan tombol unduh (`download` = fungsi unduh mitra / admin). */
export function BookFiles({
    book,
    download,
}: {
    book: PartnerBook;
    download: (kind: DocumentKind | 'ebook') => Promise<Blob>;
}) {
    const [error, setError] = useState<string>('');

    async function open(kind: DocumentKind | 'ebook', name: string) {
        setError('');

        try {
            saveBlob(await download(kind), name);
        } catch (caught) {
            setError(describeApiError(caught, 'Gagal mengunduh berkas.'));
        }
    }

    const rows: {
        kind: DocumentKind | 'ebook';
        label: string;
        name: string | null;
        extra?: string;
    }[] = [
        {
            kind: 'ebook',
            label: 'Ebook (PDF)',
            name: book.ebook.has ? book.ebook.name : null,
            extra: book.ebook.pages ? `${book.ebook.pages} halaman` : undefined,
        },
        ...(Object.keys(DOCUMENT_LABEL) as DocumentKind[]).map((kind) => ({
            kind,
            label: DOCUMENT_LABEL[kind],
            name: book.documents[kind]?.name ?? null,
            extra:
                kind === 'turnitin' && book.documents.turnitin?.percent != null
                    ? `kemiripan ${book.documents.turnitin.percent}%`
                    : undefined,
        })),
    ];

    return (
        <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-forest-moss-100 rounded-xl ring-1 ring-forest-moss-100">
                {rows.map((row) => (
                    <li
                        key={row.kind}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                    >
                        <span className="min-w-0">
                            <span className="block font-medium text-oxford-navy-900">
                                {row.label}
                            </span>
                            <span className="block truncate text-xs text-oxford-navy-900/65">
                                {row.name
                                    ? `${row.name}${row.extra ? ` • ${row.extra}` : ''}`
                                    : 'Belum diunggah'}
                            </span>
                        </span>
                        {row.name && (
                            <button
                                type="button"
                                onClick={() => open(row.kind, row.name!)}
                                className="text-sm font-semibold text-forest-moss-700 hover:underline"
                            >
                                Unduh
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}

/** Riwayat pengajuan, persetujuan, dan penolakan beserta catatannya. */
export function BookHistory({ book }: { book: PartnerBook }) {
    if (!book.events || book.events.length === 0) {
        return (
            <p className="text-sm text-oxford-navy-900/60">
                Belum ada riwayat.
            </p>
        );
    }

    return (
        <ol className="flex flex-col gap-2">
            {book.events.map((event, index) => (
                <li
                    key={index}
                    className="rounded-lg bg-forest-moss-50/70 p-3 text-sm"
                >
                    <p className="font-semibold text-oxford-navy-800">
                        {ACTION_LABEL[event.action] ?? event.action}
                        <span className="ml-2 text-xs font-normal text-oxford-navy-900/60">
                            {event.by ? `${event.by} • ` : ''}
                            {formatDateTime(event.created_at)}
                        </span>
                    </p>
                    {event.note && (
                        <p className="mt-0.5 whitespace-pre-line text-oxford-navy-900/80">
                            Catatan: {event.note}
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}
