import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import * as coverApi from '@/data/cover/coverApi';
import { ApiError } from '@/lib/http';
import CoverImage from './CoverImage';

const dateTime = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}

/** Sisa waktu "xx jam yy menit" menuju batas voting. */
function remaining(deadline: string | null): string {
    if (!deadline) return '';

    const ms = new Date(deadline).getTime() - Date.now();

    if (ms <= 0) return 'waktu berunding habis, hasil segera ditetapkan';

    const minutes = Math.floor(ms / 60000);

    return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit lagi`;
}

/**
 * Pilihan cover di halaman naskah: penulis memilih (lebih dari satu penulis = voting 24 jam),
 * bisa menambah catatan revisi atau meminta dibuat ulang. Admin melihat hasilnya.
 */
export default function CoverChoiceCard({
    manuscriptId,
}: {
    manuscriptId: number;
}) {
    const [state, setState] = useState<coverApi.CoverState | null>(null);
    const [loaded, setLoaded] = useState<boolean>(false);
    const [choice, setChoice] = useState<number | 'redo' | null>(null);
    const [note, setNote] = useState<string>('');
    const [busy, setBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    const load = useCallback(() => {
        coverApi
            .forManuscript(manuscriptId)
            .then((response) => {
                setState(response.data);
                const mine = response.data?.my_vote;
                if (mine) {
                    setChoice(mine.cover_id ?? 'redo');
                    setNote(mine.note ?? '');
                }
            })
            .catch(() => setState(null))
            .finally(() => setLoaded(true));
    }, [manuscriptId]);

    useEffect(() => {
        load();
    }, [load]);

    if (!loaded || !state) {
        return null;
    }

    const current = state.options.filter((option) => option.current);
    const chosen = state.options.find((option) => option.chosen);
    const names = new Map(
        state.options.map((o) => [o.id, `Cover ${o.position}`])
    );

    async function submit() {
        if (choice === null) return;

        setBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await coverApi.vote(
                manuscriptId,
                choice === 'redo' ? null : choice,
                note
            );
            setState(response.data);
            setMessage(response.message);
            load();
        } catch (error) {
            setIsError(true);
            setMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100">
            <div className="flex flex-wrap items-center gap-2">
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    Cover Buku
                </h5>
                <span className="rounded-full bg-forest-moss-50 px-2.5 py-0.5 text-xs font-semibold text-forest-moss-800 ring-1 ring-forest-moss-200">
                    {coverApi.STATUS_LABEL[state.status]}
                </span>
            </div>

            {state.status === 'awaiting_upload' && (
                <p className="text-sm text-oxford-navy-900/75">
                    {state.round > 1
                        ? 'Cover dibuat ulang: admin menyiapkan 3 pilihan baru.'
                        : 'Admin sedang menyiapkan 3 pilihan cover. Anda akan diberi tahu saat siap dipilih.'}
                </p>
            )}

            {state.status === 'revision' && (
                <p className="text-sm text-oxford-navy-900/75">
                    Cover {chosen ? `(${names.get(chosen.id)})` : ''} yang
                    dipilih punya catatan revisi. Admin merevisinya, lalu Anda
                    diminta menyetujuinya.
                </p>
            )}

            {state.status === 'approved' && (
                <p className="text-sm text-forest-moss-800">
                    Cover sudah final dan layak terbit.
                    {state.published_at && !state.files_purged && state.purge_at
                        ? ` Buku terbit: pilihan cover, revisi, dan dokumen revisi dihapus pada ${dateTime.format(new Date(state.purge_at))}. Unduh sekarang bila perlu.`
                        : ''}
                    {state.files_purged
                        ? ' Berkas pilihan, revisi, dan dokumen revisi sudah dihapus; tersisa riwayat, ebook, dan cover terakhir.'
                        : ''}
                </p>
            )}

            {state.status === 'voting' && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                    {state.authors.length > 1
                        ? 'Ada lebih dari satu penulis: pilih cover (voting) dan berunding. '
                        : 'Pilih cover yang Anda inginkan. '}
                    Cover dengan suara terbanyak dipakai setelah 24 jam (
                    {remaining(state.voting_deadline_at)}); bila semua penulis
                    sepakat, langsung ditetapkan. Catatan pada cover pilihan =
                    cover direvisi admin dulu.
                </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(state.status === 'approved' && chosen
                    ? [chosen]
                    : current
                ).map((option) => {
                    const votes = state.votes.filter(
                        (v) => v.cover_id === option.id
                    );

                    return (
                        <div
                            key={option.id}
                            className={`flex flex-col gap-2 rounded-xl p-3 ring-1 ${choice === option.id ? 'bg-forest-moss-50 ring-forest-moss-400' : 'ring-forest-moss-100'}`}
                        >
                            <CoverImage
                                coverId={option.id}
                                publicUrl={option.public_url}
                                purged={option.purged}
                                className="h-56 w-full"
                            />
                            <p className="text-sm font-semibold text-oxford-navy-800">
                                Cover {option.position}
                                {option.kind === 'revision' ? ' (revisi)' : ''}
                                {votes.length > 0 && (
                                    <span className="ml-1 font-normal text-oxford-navy-900/65">
                                        • {votes.length} suara
                                    </span>
                                )}
                            </p>
                            {state.can_vote && (
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name={`cover-${state.id}`}
                                        checked={choice === option.id}
                                        onChange={() => setChoice(option.id)}
                                    />
                                    Pilih cover ini
                                </label>
                            )}
                            {!option.purged && (
                                <button
                                    type="button"
                                    className="self-start text-xs font-semibold text-forest-moss-700 hover:underline"
                                    onClick={async () =>
                                        saveBlob(
                                            await coverApi.download(option.id),
                                            `cover-${option.position}.png`
                                        )
                                    }
                                >
                                    Unduh
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {state.can_vote && (
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name={`cover-${state.id}`}
                            checked={choice === 'redo'}
                            onChange={() => setChoice('redo')}
                        />
                        Tidak ada yang cocok — minta dibuat ulang
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Catatan revisi (opsional)
                        <textarea
                            rows={3}
                            maxLength={2000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Mis. judul diperbesar, warna lebih terang. Catatan pada cover pilihan membuat cover itu direvisi admin dulu."
                            className="rounded-xl p-3 text-sm font-normal outline-none ring-1 ring-forest-moss-200 focus:ring-oxford-navy-500"
                        />
                    </label>
                    <Button
                        variant="primary"
                        className="self-start"
                        disabled={busy || choice === null}
                        onClick={submit}
                    >
                        {state.my_vote
                            ? 'Ubah pilihan saya'
                            : 'Kirim pilihan saya'}
                    </Button>
                </div>
            )}

            {message && (
                <p
                    role="status"
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            {state.authors.length > 1 && state.status === 'voting' && (
                <div className="flex flex-col gap-1 text-sm">
                    <p className="font-semibold text-oxford-navy-800">
                        Suara penulis
                    </p>
                    <ul className="flex flex-col gap-1">
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
                </div>
            )}

            {state.history.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-oxford-navy-800">
                        Riwayat cover
                    </summary>
                    <ol className="mt-2 flex flex-col gap-1">
                        {state.history.map((event, index) => (
                            <li key={index} className="text-oxford-navy-900/80">
                                {coverApi.ACTION_LABEL[event.action] ??
                                    event.action}
                                {event.note ? ` — ${event.note}` : ''}
                                <span className="ml-1 text-xs text-oxford-navy-900/55">
                                    {event.created_at
                                        ? dateTime.format(
                                              new Date(event.created_at)
                                          )
                                        : ''}
                                </span>
                            </li>
                        ))}
                    </ol>
                </details>
            )}
        </div>
    );
}
