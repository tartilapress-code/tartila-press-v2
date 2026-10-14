import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/Button/Button';
import Select from '@/components/Select/Select';
import { SearchField } from '@/components/ui/FilterControls';
import * as adminApi from '@/data/admin/adminApi';
import { describeApiError } from '@/lib/apiErrors';

type Score = { matching: number; total: number; score: number | null };

type EditorRow = {
    id: number;
    name: string;
    email: string;
    is_available: boolean;
    is_coauthor: boolean;
    fields: string[];
    completed: number;
    in_progress: number;
    total: number;
    level: number;
    performance: {
        on_time: Score;
        review: Score;
        author_revision: Score;
        overall: number | null;
    };
    total_fee: number;
    unclaimed_fee: number;
    is_banned: boolean;
    ban_note: string | null;
    is_promoted: boolean;
    promoted_active: boolean;
};

type SortKey =
    | 'name'
    | 'completed'
    | 'in_progress'
    | 'fields'
    | 'coauthor'
    | 'overall'
    | 'on_time'
    | 'review'
    | 'author_revision'
    | 'level'
    | 'total_fee'
    | 'unclaimed_fee'
    | 'status';

const SORT_LABELS: Record<SortKey, string> = {
    name: 'Nama editor',
    completed: 'Naskah selesai',
    in_progress: 'Naskah dikerjakan',
    fields: 'Bidang',
    coauthor: 'Co-author',
    overall: 'Performa (keseluruhan)',
    on_time: 'Performa: ketepatan waktu',
    review: 'Performa: reject admin',
    author_revision: 'Performa: revisi penulis',
    level: 'Level',
    total_fee: 'Total fee',
    unclaimed_fee: 'Fee belum diambil',
    status: 'Status (promosi / pemantauan)',
};

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

/** Nilai yang dipakai untuk mengurutkan satu kolom (null = belum ada data, selalu di bawah). */
function sortValue(row: EditorRow, key: SortKey): string | number | null {
    switch (key) {
        case 'name':
            return row.name.toLowerCase();
        case 'completed':
            return row.completed;
        case 'in_progress':
            return row.in_progress;
        case 'fields':
            return row.fields.join(', ').toLowerCase() || null;
        case 'coauthor':
            return row.is_coauthor ? 1 : 0;
        case 'overall':
            return row.performance.overall;
        case 'on_time':
            return row.performance.on_time.score;
        case 'review':
            return row.performance.review.score;
        case 'author_revision':
            return row.performance.author_revision.score;
        case 'level':
            return row.level;
        case 'total_fee':
            return row.total_fee;
        case 'unclaimed_fee':
            return row.unclaimed_fee;
        case 'status':
            // Dipromosikan paling tinggi, lalu biasa, lalu dalam pemantauan.
            return row.is_banned ? 0 : row.is_promoted ? 2 : 1;
    }
}

function ScoreLine({ label, value }: { label: string; value: Score }) {
    return (
        <span className="block whitespace-nowrap text-xs text-oxford-navy-900/70">
            {label}:{' '}
            <strong className="text-oxford-navy-900">
                {value.score === null ? '—' : value.score.toFixed(1)}
            </strong>{' '}
            ({value.matching}/{value.total})
        </span>
    );
}

/**
 * Admin: Kelola Editor. Daftar editor dengan jumlah naskah, bidang, co-author, performa (3 nilai
 * 1-10), level, total fee dan fee belum diambil; bisa diurutkan/dicari, ditandai "dalam
 * pemantauan" (tidak bisa mengambil pool) atau dipromosikan (tampil teratas, maksimal 3).
 */
export default function EditorsManagementPage() {
    const [rows, setRows] = useState<EditorRow[] | null>(null);
    const [promotedLimit, setPromotedLimit] = useState<number>(3);
    const [loadError, setLoadError] = useState<string>('');
    const [message, setMessage] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);
    const [search, setSearch] = useState<string>('');
    const [sortKey, setSortKey] = useState<SortKey>('level');
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
    const [busyId, setBusyId] = useState<number | null>(null);
    // Editor yang sedang diberi status pemantauan (menunggu catatan).
    const [banTarget, setBanTarget] = useState<EditorRow | null>(null);
    const [banNote, setBanNote] = useState<string>('');

    function load() {
        return adminApi
            .listEditorsAdmin()
            .then((response) => {
                setRows(response.data);
                setPromotedLimit(response.meta?.promoted_limit ?? 3);
            })
            .catch((failure) =>
                setLoadError(
                    describeApiError(
                        failure,
                        'Daftar editor tidak bisa dimuat.'
                    )
                )
            );
    }

    useEffect(() => {
        load();
    }, []);

    async function run(
        row: EditorRow,
        action: () => Promise<{ message: string }>
    ) {
        setBusyId(row.id);
        setMessage(null);

        try {
            const response = await action();
            await load();
            setMessage({
                tone: 'ok',
                text: `${row.name}: ${response.message}`,
            });
        } catch (failure) {
            setMessage({ tone: 'error', text: describeApiError(failure) });
        } finally {
            setBusyId(null);
        }
    }

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = (rows ?? []).filter(
            (row) =>
                term === '' ||
                row.name.toLowerCase().includes(term) ||
                row.fields.some((field) => field.toLowerCase().includes(term))
        );
        const sign = direction === 'asc' ? 1 : -1;

        return [...filtered].sort((a, b) => {
            const left = sortValue(a, sortKey);
            const right = sortValue(b, sortKey);

            // Belum ada data selalu di bawah, apa pun arah urutannya.
            if (left === null && right === null)
                return a.name.localeCompare(b.name);
            if (left === null) return 1;
            if (right === null) return -1;
            if (left < right) return -1 * sign;
            if (left > right) return 1 * sign;

            return a.name.localeCompare(b.name);
        });
    }, [rows, search, sortKey, direction]);

    function header(key: SortKey, label: string) {
        const active = sortKey === key;

        return (
            <th
                scope="col"
                aria-sort={
                    active
                        ? direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                        : 'none'
                }
                className="p-2 text-left font-semibold"
            >
                <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-forest-moss-700"
                    onClick={() => {
                        if (active) {
                            setDirection(direction === 'asc' ? 'desc' : 'asc');
                        } else {
                            setSortKey(key);
                            setDirection(
                                key === 'name' || key === 'fields'
                                    ? 'asc'
                                    : 'desc'
                            );
                        }
                    }}
                >
                    {label}
                    <span aria-hidden className="text-xs">
                        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                </button>
            </th>
        );
    }

    if (loadError) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-sm text-red-600">
                    {loadError}
                </p>
            </div>
        );
    }

    return (
        <div className={cardClass}>
            <div className="flex flex-col gap-2">
                <h5 className="font-display text-xl font-bold text-oxford-navy-700">
                    Kelola Editor
                    {rows && (
                        <span className="ml-2 font-sans text-sm font-normal text-oxford-navy-900/60">
                            ({rows.length})
                        </span>
                    )}
                </h5>
                <p className="text-sm text-oxford-navy-900/70">
                    <strong>Level</strong> dari banyaknya naskah yang
                    dikerjakan: 1 (0–5), 2 (6–10), 3 (11–25), 4 (26–50), 5 (51
                    ke atas). <strong>Performa</strong> terdiri dari tiga nilai
                    1–10 (jumlah sesuai/jumlah total): ketepatan waktu (hasil
                    edit pertama dikirim sebelum deadline), tanpa reject admin,
                    dan tanpa permintaan revisi penulis. Level dan performa
                    hanya terlihat oleh admin dan editor yang bersangkutan.
                </p>
                <p className="text-sm text-oxford-navy-900/70">
                    <strong>Dalam pemantauan</strong>: editor tidak bisa
                    mengambil naskah dari pool, dan penulis/admin diberi
                    peringatan saat memilihnya. <strong>Dipromosikan</strong>:
                    tampil paling atas saat penulis memilih editor dan di profil
                    publik editor. Bila lebih dari {promotedLimit} editor
                    dipromosikan, hanya {promotedLimit} dengan level lalu
                    performa tertinggi yang tampil teratas.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari nama atau bidang editor"
                    ariaLabel="Cari editor"
                    className="sm:w-72"
                />
                <div className="sm:w-64">
                    <Select
                        name="editor_sort"
                        label="Urutkan"
                        option_data={(
                            Object.keys(SORT_LABELS) as SortKey[]
                        ).map((key) => ({
                            value: key,
                            label: SORT_LABELS[key],
                        }))}
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                    />
                </div>
                <Button
                    variant="outline2"
                    className="self-start sm:self-auto"
                    onClick={() =>
                        setDirection(direction === 'asc' ? 'desc' : 'asc')
                    }
                >
                    {direction === 'asc' ? 'Naik ▲' : 'Turun ▼'}
                </Button>
            </div>

            {message && (
                <p
                    role={message.tone === 'error' ? 'alert' : 'status'}
                    className={
                        message.tone === 'error'
                            ? 'text-sm text-red-600'
                            : 'text-sm text-forest-moss-700'
                    }
                >
                    {message.text}
                </p>
            )}

            {rows === null ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : visible.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/70">
                    {rows.length === 0
                        ? 'Belum ada editor.'
                        : 'Tidak ada editor yang cocok.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[68rem] text-sm">
                        <thead>
                            <tr className="bg-forest-moss-50 text-oxford-navy-900">
                                {header('name', 'Editor')}
                                {header('completed', 'Selesai')}
                                {header('in_progress', 'Dikerjakan')}
                                {header('fields', 'Bidang')}
                                {header('coauthor', 'Co-author')}
                                {header('overall', 'Performa')}
                                {header('level', 'Level')}
                                {header('total_fee', 'Total fee')}
                                {header('unclaimed_fee', 'Fee belum diambil')}
                                {header('status', 'Status')}
                                <th
                                    scope="col"
                                    className="p-2 text-left font-semibold"
                                >
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-t border-forest-moss-100 align-top"
                                >
                                    <td className="p-2">
                                        <span className="font-semibold text-oxford-navy-900">
                                            {row.name}
                                        </span>
                                        <span className="block text-xs text-oxford-navy-900/60">
                                            {row.email}
                                        </span>
                                        {!row.is_available && (
                                            <span className="block text-xs text-oxford-navy-900/60">
                                                Sedang tidak tersedia
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-2">{row.completed}</td>
                                    <td className="p-2">{row.in_progress}</td>
                                    <td className="p-2 max-w-[12rem]">
                                        {row.fields.length > 0
                                            ? row.fields.join(', ')
                                            : 'Umum'}
                                    </td>
                                    <td className="p-2">
                                        {row.is_coauthor ? 'Ya' : '—'}
                                    </td>
                                    <td className="p-2">
                                        <strong className="text-base text-forest-moss-700">
                                            {row.performance.overall === null
                                                ? '—'
                                                : row.performance.overall.toFixed(
                                                      1
                                                  )}
                                        </strong>
                                        <ScoreLine
                                            label="Waktu"
                                            value={row.performance.on_time}
                                        />
                                        <ScoreLine
                                            label="Reject"
                                            value={row.performance.review}
                                        />
                                        <ScoreLine
                                            label="Revisi penulis"
                                            value={
                                                row.performance.author_revision
                                            }
                                        />
                                    </td>
                                    <td className="p-2">
                                        <span className="rounded-full bg-forest-moss-50 px-2.5 py-0.5 text-xs font-semibold text-forest-moss-800 ring-1 ring-forest-moss-200">
                                            Level {row.level}
                                        </span>
                                        <span className="block text-xs text-oxford-navy-900/60">
                                            {row.total} naskah
                                        </span>
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                        {rupiah.format(row.total_fee)}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                        {rupiah.format(row.unclaimed_fee)}
                                    </td>
                                    <td className="p-2">
                                        <div className="flex flex-col items-start gap-1">
                                            {row.is_promoted && (
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                                                        row.promoted_active
                                                            ? 'bg-amber-50 text-amber-800 ring-amber-200'
                                                            : 'bg-white text-oxford-navy-900/70 ring-forest-moss-200'
                                                    }`}
                                                >
                                                    {row.promoted_active
                                                        ? 'Dipromosikan (teratas)'
                                                        : `Dipromosikan (di luar ${promotedLimit} teratas)`}
                                                </span>
                                            )}
                                            {row.is_banned && (
                                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                                                    Dalam pemantauan
                                                </span>
                                            )}
                                            {row.is_banned && row.ban_note && (
                                                <span className="max-w-[12rem] text-xs text-oxford-navy-900/65">
                                                    {row.ban_note}
                                                </span>
                                            )}
                                            {!row.is_promoted &&
                                                !row.is_banned && (
                                                    <span className="text-xs text-oxford-navy-900/50">
                                                        —
                                                    </span>
                                                )}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <div className="flex flex-col items-start gap-1.5">
                                            <Button
                                                variant={
                                                    row.is_promoted
                                                        ? 'outline2'
                                                        : 'primary'
                                                }
                                                disabled={
                                                    busyId === row.id ||
                                                    (row.is_banned &&
                                                        !row.is_promoted)
                                                }
                                                onClick={() =>
                                                    run(row, () =>
                                                        adminApi.promoteEditorAdmin(
                                                            row.id,
                                                            !row.is_promoted
                                                        )
                                                    )
                                                }
                                            >
                                                {row.is_promoted
                                                    ? 'Cabut promosi'
                                                    : 'Promosikan'}
                                            </Button>
                                            <Button
                                                variant="outline2"
                                                disabled={busyId === row.id}
                                                onClick={() => {
                                                    if (row.is_banned) {
                                                        void run(row, () =>
                                                            adminApi.banEditorAdmin(
                                                                row.id,
                                                                false
                                                            )
                                                        );
                                                    } else {
                                                        setBanTarget(row);
                                                        setBanNote('');
                                                    }
                                                }}
                                            >
                                                {row.is_banned
                                                    ? 'Cabut pemantauan'
                                                    : 'Pantau (banned)'}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {banTarget && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Tandai ${banTarget.name} dalam pemantauan`}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                >
                    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-6 shadow-xl">
                        <h6 className="font-display text-lg font-bold text-oxford-navy-700">
                            Tandai {banTarget.name} dalam pemantauan
                        </h6>
                        <p className="text-sm text-oxford-navy-900/75">
                            Editor ini tidak bisa mengambil naskah dari pool.
                            Saat penulis atau admin memilihnya, muncul
                            keterangan &quot;dalam pemantauan&quot; dengan saran
                            memilih editor lain. Promosi (bila ada) dicabut.
                        </p>
                        <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                            Catatan internal (tidak terlihat oleh penulis)
                            <textarea
                                rows={3}
                                maxLength={1000}
                                value={banNote}
                                onChange={(e) => setBanNote(e.target.value)}
                                className="rounded-xl p-3 text-sm font-normal outline-none ring-1 ring-forest-moss-200 focus:ring-oxford-navy-500"
                            />
                        </label>
                        <div className="flex flex-row gap-2">
                            <Button
                                variant="primary"
                                disabled={busyId === banTarget.id}
                                onClick={() => {
                                    const target = banTarget;
                                    setBanTarget(null);
                                    void run(target, () =>
                                        adminApi.banEditorAdmin(
                                            target.id,
                                            true,
                                            banNote.trim() || undefined
                                        )
                                    );
                                }}
                            >
                                Tandai dalam pemantauan
                            </Button>
                            <Button
                                variant="outline2"
                                onClick={() => setBanTarget(null)}
                            >
                                Batal
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
