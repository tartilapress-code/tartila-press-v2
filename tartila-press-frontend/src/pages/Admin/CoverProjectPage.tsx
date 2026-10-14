import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import CoverImage from '@/components/cover/CoverImage';
import * as coverApi from '@/data/cover/coverApi';
import { describeApiError } from '@/lib/apiErrors';

const dateTime = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

/** Admin: satu proyek cover — unggah 3 pilihan, lihat suara & catatan, revisi, tetapkan pemenang. */
export default function CoverProjectPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [state, setState] = useState<coverApi.CoverState | null>(null);
    const [error, setError] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(() => {
        coverApi
            .project(projectId ?? '')
            .then((response) => setState(response.data))
            .catch((failure) => setError(describeApiError(failure)));
    }, [projectId]);

    useEffect(() => {
        load();
    }, [load]);

    async function act(
        key: string,
        task: () => Promise<{ data: coverApi.CoverState; message: string }>
    ) {
        setBusy(key);
        setMessage('');
        setError('');

        try {
            const response = await task();
            setState(response.data);
            setMessage(response.message);
        } catch (failure) {
            setError(describeApiError(failure));
        } finally {
            setBusy(null);
        }
    }

    if (error && !state) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            </div>
        );
    }

    if (!state) {
        return (
            <div className={cardClass}>
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            </div>
        );
    }

    const current = state.options.filter((option) => option.current);
    const slots = [1, 2, 3];
    const canUpload = state.status === 'awaiting_upload';
    const early = state.stage === 'early';
    const names = new Map(
        state.options.map((o) => [o.id, `Cover ${o.position}`])
    );

    function onFile(position: number, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (file) {
            void act(`up-${position}`, () =>
                coverApi.upload(state!.id, file, position)
            );
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <div className={cardClass}>
                <Link
                    to="/admin/covers"
                    className="text-sm font-semibold text-forest-moss-700 hover:underline"
                >
                    ← Daftar cover
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                        {state.title}
                    </h5>
                    <span className="rounded-full bg-forest-moss-50 px-2.5 py-0.5 text-xs font-semibold text-forest-moss-800 ring-1 ring-forest-moss-200">
                        {coverApi.STATUS_LABEL[state.status]}
                    </span>
                    {state.source === 'chapter' && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-forest-moss-200">
                            Book Chapter
                            {early ? ' — cover awal (belum mendesak)' : ''}
                        </span>
                    )}
                </div>
                {state.round > 1 && (
                    <p className="text-sm text-oxford-navy-900/70">
                        Ronde {state.round}.
                    </p>
                )}
                {state.manuscript_id && (
                    <Link
                        to={`/dashboard/naskah/${state.manuscript_id}`}
                        className="text-sm text-forest-moss-700 hover:underline"
                    >
                        Lihat naskah →
                    </Link>
                )}
                {early && (
                    <p className="text-sm text-oxford-navy-900/75">
                        Cover awal tampil publik di halaman proyek menggantikan
                        cover bawaan. Dua cover pembanding diunggah saat masa
                        tenggat; voting dibuka setelah naskah gabungan di-auto
                        layout.
                    </p>
                )}
                {message && (
                    <p role="status" className="text-sm text-forest-moss-700">
                        {message}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
            </div>

            {state.status !== 'revision' && (
                <div className={cardClass}>
                    <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                        {canUpload ? 'Unggah pilihan cover' : 'Pilihan cover'}
                    </h6>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {slots.map((position) => {
                            const option = current.find(
                                (item) => item.position === position
                            );

                            return (
                                <div
                                    key={position}
                                    className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-forest-moss-100"
                                >
                                    {option ? (
                                        <CoverImage
                                            coverId={option.id}
                                            publicUrl={option.public_url}
                                            purged={option.purged}
                                            className="h-56 w-full"
                                        />
                                    ) : (
                                        <div className="flex h-56 items-center justify-center rounded-lg bg-forest-moss-50 text-sm text-oxford-navy-900/55">
                                            Belum diunggah
                                        </div>
                                    )}
                                    <p className="text-sm font-semibold text-oxford-navy-800">
                                        Cover {position}
                                        {option?.chosen && ' • terpilih'}
                                    </p>
                                    {canUpload && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label
                                                className={`cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-oxford-navy-800 ring-1 ring-forest-moss-200 hover:bg-forest-moss-50 ${busy === `up-${position}` ? 'opacity-50' : ''}`}
                                            >
                                                {busy === `up-${position}`
                                                    ? 'Mengunggah...'
                                                    : option
                                                      ? 'Ganti'
                                                      : 'Unggah'}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    className="sr-only"
                                                    disabled={busy !== null}
                                                    onChange={(event) =>
                                                        onFile(position, event)
                                                    }
                                                />
                                            </label>
                                            {option &&
                                                !(early && position === 1) && (
                                                    <button
                                                        type="button"
                                                        className="text-xs font-semibold text-red-600 hover:underline"
                                                        onClick={() =>
                                                            act(
                                                                `rm-${position}`,
                                                                () =>
                                                                    coverApi.removeCover(
                                                                        option.id
                                                                    )
                                                            )
                                                        }
                                                    >
                                                        Hapus
                                                    </button>
                                                )}
                                        </div>
                                    )}
                                    {state.status === 'voting' && option && (
                                        <Button
                                            variant="outline2"
                                            disabled={busy !== null}
                                            onClick={() =>
                                                act(`decide-${position}`, () =>
                                                    coverApi.decide(
                                                        state.id,
                                                        option.id
                                                    )
                                                )
                                            }
                                        >
                                            Tetapkan cover ini
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {state.status === 'revision' && (
                <div className={cardClass}>
                    <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                        Revisi cover terpilih
                    </h6>
                    <p className="text-sm text-oxford-navy-900/75">
                        Cover yang dipilih penulis memuat catatan revisi. Unggah
                        hasil revisinya; penulis lalu diminta menyetujuinya.
                    </p>
                    {state.options
                        .filter((o) => o.chosen)
                        .map((option) => (
                            <div
                                key={option.id}
                                className="flex items-start gap-4"
                            >
                                <CoverImage
                                    coverId={option.id}
                                    publicUrl={option.public_url}
                                    purged={option.purged}
                                    className="h-48 w-36"
                                />
                                <p className="text-sm font-semibold">
                                    Cover {option.position}
                                </p>
                            </div>
                        ))}
                    <label
                        className={`w-fit cursor-pointer rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-navy-600 ${busy === 'revision' ? 'opacity-50' : ''}`}
                    >
                        {busy === 'revision'
                            ? 'Mengunggah...'
                            : 'Unggah revisi cover'}
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={busy !== null}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file)
                                    void act('revision', () =>
                                        coverApi.uploadRevision(state.id, file)
                                    );
                            }}
                        />
                    </label>
                </div>
            )}

            <div className={cardClass}>
                <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                    Suara & catatan penulis
                </h6>
                {state.status === 'voting' && state.voting_deadline_at && (
                    <p className="text-sm text-oxford-navy-900/75">
                        Batas{' '}
                        {dateTime.format(new Date(state.voting_deadline_at))}:
                        suara terbanyak dipakai (seri: nomor terkecil).
                    </p>
                )}
                {state.authors.length === 0 ? (
                    <p className="text-sm text-oxford-navy-900/65">
                        Belum ada penulis (naskah belum terisi).
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1 text-sm">
                        {state.authors.map((author) => {
                            const vote = state.votes.find(
                                (v) => v.user_id === author.id
                            );

                            return (
                                <li
                                    key={author.id}
                                    className="rounded bg-forest-moss-50 px-3 py-1.5 ring-1 ring-forest-moss-100"
                                >
                                    {author.name}:{' '}
                                    {vote
                                        ? vote.cover_id === null
                                            ? 'minta dibuat ulang'
                                            : (names.get(vote.cover_id) ??
                                              'cover')
                                        : 'belum memilih'}
                                    {vote?.note && (
                                        <span className="block text-xs text-oxford-navy-900/70">
                                            Catatan: {vote.note}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {state.status === 'approved' && state.published_at && (
                    <p className="text-sm text-oxford-navy-900/70">
                        {state.files_purged
                            ? 'Berkas pilihan, revisi, dan dokumen revisi sudah dihapus; tersisa riwayat dan cover terakhir.'
                            : state.purge_at
                              ? `Berkas pilihan/revisi dihapus otomatis ${dateTime.format(new Date(state.purge_at))}.`
                              : ''}
                    </p>
                )}
            </div>

            {state.history.length > 0 && (
                <div className={cardClass}>
                    <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                        Riwayat
                    </h6>
                    <ol className="flex flex-col gap-1 text-sm">
                        {state.history.map((event, index) => (
                            <li key={index}>
                                <strong>
                                    {coverApi.ACTION_LABEL[event.action] ??
                                        event.action}
                                </strong>
                                {event.note ? ` — ${event.note}` : ''}
                                <span className="ml-1 text-xs text-oxford-navy-900/55">
                                    {event.by ? `${event.by} • ` : ''}
                                    {event.created_at
                                        ? dateTime.format(
                                              new Date(event.created_at)
                                          )
                                        : ''}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
