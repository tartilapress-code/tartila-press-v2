import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as manuscriptApi from '@/data/manuscript/manuscriptApi';
import { describeApiError } from '@/lib/apiErrors';
import { saveBlob } from '@/lib/download';
import { SHORT_STATUS_LABELS } from '@/lib/manuscriptStatus';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

/** Bab yang boleh diberi catatan revisi (tidak sedang direview admin). */
const REQUESTABLE = [
    'compiled',
    'awaiting_compilation',
    'revision_requested',
    'completed',
];

/**
 * Naskah gabungan Book Chapter: editor mengerjakan seluruh buku, tetapi tetap
 * punya daftar naskah awal per bab. Catatan revisi diberikan per bab dan
 * dikirim ke penulis bab tersebut.
 */
export default function CompilationChaptersPanel({
    manuscriptId,
    isFinished,
}: {
    manuscriptId: number;
    isFinished: boolean;
}) {
    const [chapters, setChapters] = useState<
        manuscriptApi.CompilationChapter[]
    >([]);
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [busyId, setBusyId] = useState<number | null>(null);
    const [message, setMessage] = useState<string>('');

    function load() {
        return manuscriptApi
            .compilationChapters(manuscriptId)
            .then((response) => setChapters(response.data))
            .catch((caught) => setMessage(describeApiError(caught)));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manuscriptId]);

    async function download(
        chapterManuscriptId: number,
        revisionId: number,
        filename: string
    ) {
        try {
            const blob = await manuscriptApi.downloadRevision(
                chapterManuscriptId,
                revisionId
            );
            saveBlob(blob, filename);
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    async function sendNote(chapterManuscriptId: number) {
        const note = (notes[chapterManuscriptId] ?? '').trim();

        if (note === '') return;

        setBusyId(chapterManuscriptId);
        setMessage('');

        try {
            await manuscriptApi.requestChapterRevision(
                manuscriptId,
                chapterManuscriptId,
                note
            );
            setNotes({ ...notes, [chapterManuscriptId]: '' });
            await load();
        } catch (caught) {
            setMessage(describeApiError(caught));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Naskah Awal per Bab
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Yang dikerjakan adalah naskah gabungan di atas (semua bab
                    sudah disusun menjadi buku). Naskah asli tiap bab tersedia
                    di sini sebagai rujukan. Catatan revisi suatu bab dikirim ke
                    penulis bab tersebut; revisinya diperiksa admin lalu muncul
                    di daftar ini.
                </p>
            </div>

            {chapters.map((chapter) => {
                const manuscript = chapter.manuscript;
                const open =
                    manuscript?.revision_requests.filter(
                        (item) => item.resolved_at === null
                    ) ?? [];

                return (
                    <details
                        key={chapter.id}
                        className="rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 px-4 py-3"
                    >
                        <summary className="flex cursor-pointer flex-row flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-oxford-navy-900">
                                BAB {chapter.chapter_number} · {chapter.title}
                                {manuscript?.author
                                    ? ` — ${manuscript.author}`
                                    : ''}
                            </span>
                            <span className="text-xs text-oxford-navy-900/70">
                                {manuscript
                                    ? (SHORT_STATUS_LABELS[manuscript.status] ??
                                      manuscript.status)
                                    : 'Tidak ada naskah'}
                                {open.length > 0 &&
                                    ` · ${open.length} catatan revisi terbuka`}
                            </span>
                        </summary>

                        {manuscript && (
                            <div className="mt-3 flex flex-col gap-3 text-sm">
                                <ul className="flex flex-col gap-1">
                                    {manuscript.revisions.map(
                                        (revision, index) => (
                                            <li
                                                key={revision.id}
                                                className="flex flex-row flex-wrap items-center justify-between gap-2 rounded bg-white px-3 py-2 ring-1 ring-forest-moss-100"
                                            >
                                                <span className="text-oxford-navy-900/80">
                                                    {index ===
                                                    manuscript.revisions
                                                        .length -
                                                        1
                                                        ? 'Naskah awal'
                                                        : `Revisi penulis ${revision.revision_number}`}{' '}
                                                    ·{' '}
                                                    {revision.original_filename}{' '}
                                                    ·{' '}
                                                    {revision.admin_status ===
                                                    'approved'
                                                        ? 'disetujui admin'
                                                        : revision.admin_status ===
                                                            'rejected'
                                                          ? 'ditolak admin'
                                                          : 'menunggu review admin'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        download(
                                                            manuscript.id,
                                                            revision.id,
                                                            revision.original_filename
                                                        )
                                                    }
                                                    className="text-forest-moss-700 hover:text-forest-moss-800"
                                                >
                                                    Download
                                                </button>
                                            </li>
                                        )
                                    )}
                                </ul>

                                {manuscript.revision_requests.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <p className="font-semibold text-oxford-navy-900">
                                            Catatan revisi bab ini
                                        </p>
                                        {manuscript.revision_requests.map(
                                            (item) => (
                                                <p
                                                    key={item.id}
                                                    className="rounded bg-white px-3 py-2 ring-1 ring-forest-moss-100 text-oxford-navy-900/80"
                                                >
                                                    {item.note}
                                                    <span className="block text-xs text-oxford-navy-900/55">
                                                        {item.requested_by ??
                                                            '-'}{' '}
                                                        ·{' '}
                                                        {dateFormatter.format(
                                                            new Date(
                                                                item.created_at
                                                            )
                                                        )}{' '}
                                                        ·{' '}
                                                        {item.resolved_at
                                                            ? 'sudah direvisi penulis'
                                                            : 'menunggu revisi penulis'}
                                                    </span>
                                                </p>
                                            )
                                        )}
                                    </div>
                                )}

                                {!isFinished &&
                                    REQUESTABLE.includes(manuscript.status) && (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                rows={3}
                                                value={
                                                    notes[manuscript.id] ?? ''
                                                }
                                                onChange={(e) =>
                                                    setNotes({
                                                        ...notes,
                                                        [manuscript.id]:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder={`Catatan revisi untuk ${manuscript.author ?? 'penulis'} (BAB ${chapter.chapter_number})`}
                                                className="w-full rounded-lg ring-1 ring-forest-moss-200 bg-white p-2 text-oxford-navy-900 outline-none placeholder:text-oxford-navy-900/40"
                                            />
                                            <Button
                                                variant="outline2"
                                                className="self-start"
                                                disabled={
                                                    busyId === manuscript.id ||
                                                    (
                                                        notes[manuscript.id] ??
                                                        ''
                                                    ).trim() === ''
                                                }
                                                onClick={() =>
                                                    sendNote(manuscript.id)
                                                }
                                            >
                                                {busyId === manuscript.id
                                                    ? 'Mengirim...'
                                                    : 'Kirim Catatan Revisi ke Penulis Bab'}
                                            </Button>
                                        </div>
                                    )}
                            </div>
                        )}
                    </details>
                );
            })}

            {message && <p className="text-red-600 text-sm">{message}</p>}
        </div>
    );
}
