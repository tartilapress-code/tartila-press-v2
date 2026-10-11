import { useCallback, useState, type FormEvent } from 'react';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatDateTime, fromDateTimeLocal } from '@/lib/format';

const field =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm';

/** Admin: jadwal buku dibuka (baca gratis) atau dikunci, per judul atau semua buku. */
export default function AdminRulesPage() {
    const rules = useLoad(useCallback(() => api.adminRules(), []));
    const [bookSearch, setBookSearch] = useState<string>('');
    const books = useLoad(
        useCallback(
            () => api.adminBooks({ page: 1, search: bookSearch }),
            [bookSearch]
        )
    );
    const [target, setTarget] = useState<string>('');
    const [action, setAction] = useState<'open' | 'lock'>('open');
    const [starts, setStarts] = useState<string>('');
    const [ends, setEnds] = useState<string>('');
    const [note, setNote] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    async function add(event: FormEvent) {
        event.preventDefault();
        setMessage('');
        setIsError(false);

        try {
            await api.adminAddRule({
                reader_book_id: target ? Number(target) : null,
                action,
                starts_at:
                    fromDateTimeLocal(starts) ?? new Date().toISOString(),
                ends_at: fromDateTimeLocal(ends),
                note: note.trim() || null,
            });
            setNote('');
            setEnds('');
            setMessage('Jadwal disimpan.');
            rules.reload();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Jadwal buka / kunci
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Secara bawaan buku terkunci (kecuali penulis, pelanggan,
                    atau pembeli). <strong>Dibuka</strong> = semua orang bisa
                    membacanya gratis selama jadwal. <strong>Dikunci</strong> =
                    mematikan baca gratis (mis. semua buku dibuka akhir pekan,
                    kecuali satu judul); penulis, pelanggan, dan pembeli tetap
                    bisa membaca. Jadwal khusus judul mengalahkan jadwal "semua
                    buku".
                </p>
            </div>

            <form
                onSubmit={add}
                className="grid gap-4 rounded-xl bg-forest-moss-50/70 p-4 sm:grid-cols-2"
            >
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900 sm:col-span-2">
                    Cari judul buku
                    <input
                        className={field}
                        value={bookSearch}
                        placeholder="Ketik untuk mempersempit pilihan"
                        onChange={(e) => setBookSearch(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900 sm:col-span-2">
                    Judul buku
                    <select
                        className={field}
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                    >
                        <option value="">Semua buku</option>
                        {books.data?.data.map((book) => (
                            <option key={book.id} value={book.id}>
                                {book.book.title}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Tindakan
                    <select
                        className={field}
                        value={action}
                        onChange={(e) =>
                            setAction(e.target.value as 'open' | 'lock')
                        }
                    >
                        <option value="open">Buka (baca gratis)</option>
                        <option value="lock">Kunci</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Catatan (opsional)
                    <input
                        className={field}
                        maxLength={255}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Mulai (WIB)
                    <input
                        type="datetime-local"
                        required
                        className={field}
                        value={starts}
                        onChange={(e) => setStarts(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Selesai (WIB, kosong = tanpa batas)
                    <input
                        type="datetime-local"
                        className={field}
                        value={ends}
                        min={starts}
                        onChange={(e) => setEnds(e.target.value)}
                    />
                </label>
                <div className="flex items-center gap-3 sm:col-span-2">
                    <Button type="submit">Simpan jadwal</Button>
                    {message && (
                        <span
                            role="status"
                            className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                        >
                            {message}
                        </span>
                    )}
                </div>
            </form>

            {rules.error && <p className="text-red-600">{rules.error}</p>}

            <ul className="flex flex-col gap-2">
                {rules.data?.data.map((rule) => (
                    <li
                        key={rule.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-forest-moss-100"
                    >
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-oxford-navy-900">
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${rule.action === 'open' ? 'bg-amber-100 text-amber-900' : 'bg-oxford-navy-900/10 text-oxford-navy-800'}`}
                                >
                                    {rule.action === 'open'
                                        ? 'Dibuka (gratis)'
                                        : 'Dikunci'}
                                </span>
                                {rule.title ?? 'Semua buku'}
                                {rule.active && (
                                    <span className="rounded-full bg-forest-moss-100 px-2 py-0.5 text-[11px] text-forest-moss-800">
                                        Berlaku sekarang
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-oxford-navy-900/65">
                                {formatDateTime(rule.starts_at)} →{' '}
                                {rule.ends_at
                                    ? formatDateTime(rule.ends_at)
                                    : 'tanpa batas'}
                                {rule.note ? ` • ${rule.note}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="text-sm font-semibold text-red-600 hover:cursor-pointer hover:underline"
                            onClick={async () => {
                                await api
                                    .adminDeleteRule(rule.id)
                                    .catch(() => undefined);
                                rules.reload();
                            }}
                        >
                            Hapus
                        </button>
                    </li>
                ))}
                {rules.data && rules.data.data.length === 0 && (
                    <li className="text-sm text-oxford-navy-900/60">
                        Belum ada jadwal.
                    </li>
                )}
            </ul>
        </div>
    );
}
