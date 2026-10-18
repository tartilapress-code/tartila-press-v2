import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as recommendationApi from '@/data/recommendation/recommendationApi';
import type {
    RecommendationItem,
    RecommendationSection,
} from '@/data/recommendation/recommendationApi';
import { describeApiError } from '@/lib/apiErrors';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

/** Satu menu: daftar pin (urutan = posisi), pencarian konten, simpan. */
function SectionCard({ initial }: { initial: RecommendationSection }) {
    const [items, setItems] = useState<RecommendationItem[]>(initial.items);
    const [search, setSearch] = useState<string>('');
    const [results, setResults] = useState<RecommendationItem[]>([]);
    const [dirty, setDirty] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [error, setError] = useState<string>('');

    const full = items.length >= initial.limit;

    // Pilihan konten (hanya yang tampil publik), dicari saat mengetik.
    useEffect(() => {
        if (initial.managed_elsewhere || full) {
            return;
        }

        const timer = window.setTimeout(() => {
            recommendationApi
                .options(initial.section, search)
                .then((response) => setResults(response.data))
                .catch(() => setResults([]));
        }, 250);

        return () => window.clearTimeout(timer);
    }, [initial.section, initial.managed_elsewhere, search, full]);

    function change(next: RecommendationItem[]) {
        setItems(next);
        setDirty(true);
        setMessage('');
        setError('');
    }

    function move(index: number, delta: number) {
        const target = index + delta;

        if (target < 0 || target >= items.length) {
            return;
        }

        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        change(next);
    }

    async function save() {
        setBusy(true);
        setError('');

        try {
            const response = await recommendationApi.save(
                initial.section,
                items.map((item) => item.id)
            );
            setItems(response.data);
            setDirty(false);
            setMessage(response.message);
        } catch (failure) {
            setError(describeApiError(failure));
        } finally {
            setBusy(false);
        }
    }

    const available = results.filter(
        (result) => !items.some((item) => item.id === result.id)
    );

    return (
        <div className={cardClass}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                    {initial.label}
                </h6>
                <span className="text-xs text-oxford-navy-900/60">
                    {items.length}/{initial.limit} dipin
                </span>
            </div>

            {initial.managed_elsewhere ? (
                <p className="text-sm text-oxford-navy-900/70">
                    Rekomendasi editor dikelola lewat tombol{' '}
                    <strong>Promosikan</strong> di{' '}
                    <Link
                        to="/admin/editors"
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Kelola Editor
                    </Link>{' '}
                    (maksimal 3, level dan performa tertinggi paling atas).
                </p>
            ) : null}

            {items.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/60">
                    Belum ada rekomendasi.
                    {initial.managed_elsewhere
                        ? ''
                        : ' Tanpa pin, menu tampil dengan urutan biasa.'}
                </p>
            ) : (
                <ol className="flex flex-col gap-2">
                    {items.map((item, index) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl bg-forest-moss-50 px-3 py-2 ring-1 ring-forest-moss-100"
                        >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950">
                                {index + 1}
                            </span>
                            {item.image && (
                                <img
                                    src={item.image}
                                    alt=""
                                    className="size-10 shrink-0 rounded object-cover"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-oxford-navy-900">
                                    {item.title}
                                </p>
                                {item.subtitle && (
                                    <p className="truncate text-xs text-oxford-navy-900/60">
                                        {item.subtitle}
                                    </p>
                                )}
                                {item.visible === false && (
                                    <p className="text-xs text-red-600">
                                        Tidak tampil di publik saat ini
                                        (nonaktif / belum terbit).
                                    </p>
                                )}
                            </div>
                            {!initial.managed_elsewhere && (
                                <div className="flex items-center gap-1 text-sm">
                                    <button
                                        type="button"
                                        aria-label="Naikkan"
                                        disabled={index === 0}
                                        onClick={() => move(index, -1)}
                                        className="rounded px-2 py-1 ring-1 ring-forest-moss-200 disabled:opacity-40"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Turunkan"
                                        disabled={index === items.length - 1}
                                        onClick={() => move(index, 1)}
                                        className="rounded px-2 py-1 ring-1 ring-forest-moss-200 disabled:opacity-40"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            change(
                                                items.filter(
                                                    (other) =>
                                                        other.id !== item.id
                                                )
                                            )
                                        }
                                        className="rounded px-2 py-1 text-red-600 hover:underline"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}

            {!initial.managed_elsewhere && !full && (
                <div className="flex flex-col gap-2">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={`Cari ${initial.label.toLowerCase()} untuk dipin...`}
                        aria-label={`Cari ${initial.label}`}
                        className="rounded-lg bg-transparent p-2 text-sm text-oxford-navy-900 outline-none ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40"
                    />
                    {available.length === 0 ? (
                        <p className="text-xs text-oxford-navy-900/55">
                            Tidak ada konten yang bisa dipin (hanya yang tampil
                            di publik).
                        </p>
                    ) : (
                        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                            {available.slice(0, 12).map((result) => (
                                <li
                                    key={result.id}
                                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm ring-1 ring-forest-moss-100"
                                >
                                    <span className="min-w-0 truncate">
                                        {result.title}
                                        {result.subtitle && (
                                            <span className="ml-2 text-xs text-oxford-navy-900/55">
                                                {result.subtitle}
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            change([...items, result])
                                        }
                                        className="shrink-0 font-semibold text-forest-moss-700 hover:underline"
                                    >
                                        Pin
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {!initial.managed_elsewhere && (
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="primary"
                        disabled={!dirty || busy}
                        onClick={save}
                    >
                        {busy ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    {message && (
                        <p
                            role="status"
                            className="text-sm text-forest-moss-700"
                        >
                            {message}
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="text-sm text-red-600">
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/** Admin: Rekomendasi. Pin maksimal 3 konten per menu; tampil paling atas di menunya dan di beranda. */
export default function RecommendationsPage() {
    const [sections, setSections] = useState<RecommendationSection[] | null>(
        null
    );
    const [error, setError] = useState<string>('');

    useEffect(() => {
        recommendationApi
            .list()
            .then((response) => setSections(response.data))
            .catch((failure) => setError(describeApiError(failure)));
    }, []);

    return (
        <div className="flex flex-col gap-5">
            <div className={cardClass}>
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    Rekomendasi
                </h5>
                <p className="text-sm text-oxford-navy-900/70">
                    Pin maksimal 3 konten untuk tiap menu. Konten yang dipin
                    tampil <strong>paling atas</strong> di halaman menunya
                    dengan lencana &ldquo;Rekomendasi&rdquo;, dan ikut tampil
                    paling depan di <strong>beranda</strong>. Urutan di sini =
                    urutan tampil. Hanya konten yang tampil di publik yang bisa
                    dipin.
                </p>
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
            </div>

            {sections === null && !error && (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            )}

            {sections?.map((section) => (
                <SectionCard key={section.section} initial={section} />
            ))}
        </div>
    );
}
