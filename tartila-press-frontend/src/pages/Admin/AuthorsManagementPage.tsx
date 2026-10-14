import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/Button/Button';
import Select from '@/components/Select/Select';
import { SearchField } from '@/components/ui/FilterControls';
import * as adminApi from '@/data/admin/adminApi';
import { describeApiError } from '@/lib/apiErrors';

type ProgressNote = {
    type: 'manuscript' | 'mou' | 'book' | 'isbn' | 'hki' | 'physical';
    title: string;
    text: string;
};

type AuthorRow = {
    id: number;
    name: string;
    email: string;
    fields: string[];
    published_books: number;
    in_process: number;
    royalty_total: number;
    royalty_unclaimed: number;
    notes: ProgressNote[];
    admin_note: string | null;
};

type SortKey =
    | 'name'
    | 'fields'
    | 'published_books'
    | 'in_process'
    | 'royalty_total'
    | 'royalty_unclaimed'
    | 'notes';

const SORT_LABELS: Record<SortKey, string> = {
    name: 'Nama penulis',
    fields: 'Bidang',
    published_books: 'Buku terbit',
    in_process: 'Naskah dalam proses',
    royalty_total: 'Jumlah royalti',
    royalty_unclaimed: 'Royalti belum dicairkan',
    notes: 'Banyak catatan',
};

const NOTE_LABELS: Record<ProgressNote['type'], string> = {
    manuscript: 'Naskah',
    mou: 'MOU',
    book: 'Buku',
    isbn: 'ISBN',
    hki: 'HKI',
    physical: 'Buku fisik',
};

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

function sortValue(row: AuthorRow, key: SortKey): string | number {
    switch (key) {
        case 'name':
            return row.name.toLowerCase();
        case 'fields':
            // Penulis tanpa bidang di urutan paling akhir pada urutan naik.
            return row.fields.join(', ').toLowerCase() || '￿';
        case 'notes':
            return row.notes.length;
        default:
            return row[key];
    }
}

/** Satu baris catatan progres: label jenis, judul buku/naskah, lalu keterangannya. */
function NoteItem({ note }: { note: ProgressNote }) {
    return (
        <li className="text-xs leading-snug">
            <span className="mr-1 rounded bg-forest-moss-50 px-1.5 py-0.5 font-semibold text-forest-moss-800 ring-1 ring-forest-moss-200">
                {NOTE_LABELS[note.type]}
            </span>
            <strong className="text-oxford-navy-900">“{note.title}”</strong>{' '}
            <span className="text-oxford-navy-900/75">— {note.text}</span>
        </li>
    );
}

function AdminNote({
    row,
    onSaved,
}: {
    row: AuthorRow;
    onSaved: (note: string | null) => void;
}) {
    const [editing, setEditing] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>(row.admin_note ?? '');
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function save() {
        setBusy(true);
        setError('');

        try {
            const response = await adminApi.saveAuthorNoteAdmin(row.id, draft);
            onSaved(response.data.admin_note);
            setEditing(false);
        } catch (failure) {
            setError(describeApiError(failure));
        } finally {
            setBusy(false);
        }
    }

    if (!editing) {
        return (
            <div className="mt-1 flex flex-col items-start gap-1">
                {row.admin_note && (
                    <p className="whitespace-pre-line rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-200">
                        Catatan admin: {row.admin_note}
                    </p>
                )}
                <button
                    type="button"
                    className="text-xs font-medium text-forest-moss-700 underline"
                    onClick={() => {
                        setDraft(row.admin_note ?? '');
                        setEditing(true);
                    }}
                >
                    {row.admin_note ? 'Ubah catatan admin' : '+ Catatan admin'}
                </button>
            </div>
        );
    }

    return (
        <div className="mt-1 flex flex-col gap-1">
            <textarea
                rows={3}
                maxLength={5000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={`Catatan admin untuk ${row.name}`}
                className="w-full rounded-lg p-2 text-xs outline-none ring-1 ring-forest-moss-200 focus:ring-oxford-navy-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
                <Button variant="primary" onClick={save} disabled={busy}>
                    Simpan
                </Button>
                <Button variant="outline2" onClick={() => setEditing(false)}>
                    Batal
                </Button>
            </div>
        </div>
    );
}

/**
 * Admin: Kelola Penulis. Daftar penulis dengan bidang (dari buku terbitnya), jumlah buku
 * terbit, naskah dalam proses, royalti, royalti yang belum dicairkan, serta catatan progres
 * dan hak yang belum selesai (HKI, ISBN, buku, MOU, ...) lengkap dengan judul bukunya.
 */
export default function AuthorsManagementPage() {
    const [rows, setRows] = useState<AuthorRow[] | null>(null);
    const [loadError, setLoadError] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        adminApi
            .listAuthorsAdmin()
            .then((response) => setRows(response.data))
            .catch((failure) =>
                setLoadError(
                    describeApiError(
                        failure,
                        'Daftar penulis tidak bisa dimuat.'
                    )
                )
            );
    }, []);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = (rows ?? []).filter(
            (row) =>
                term === '' ||
                row.name.toLowerCase().includes(term) ||
                row.fields.some((field) =>
                    field.toLowerCase().includes(term)
                ) ||
                row.notes.some((note) =>
                    note.title.toLowerCase().includes(term)
                )
        );
        const sign = direction === 'asc' ? 1 : -1;

        return [...filtered].sort((a, b) => {
            const left = sortValue(a, sortKey);
            const right = sortValue(b, sortKey);

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
                    Kelola Penulis
                    {rows && (
                        <span className="ml-2 font-sans text-sm font-normal text-oxford-navy-900/60">
                            ({rows.length})
                        </span>
                    )}
                </h5>
                <p className="text-sm text-oxford-navy-900/70">
                    <strong>Bidang</strong> diambil dari kategori keilmuan buku
                    terbit penulis. <strong>Naskah dalam proses</strong> =
                    naskah yang belum berstatus selesai.{' '}
                    <strong>Royalti belum dicairkan</strong> = jumlah royalti
                    dikurangi penarikan (perkiraan, karena penarikan dompet
                    dipakai bersama fee lain). <strong>Catatan</strong> menyusun
                    otomatis progres dan hak yang belum selesai beserta judul
                    bukunya.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari nama, bidang, atau judul buku"
                    ariaLabel="Cari penulis"
                    className="sm:w-72"
                />
                <div className="sm:w-64">
                    <Select
                        name="author_sort"
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

            {rows === null ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : visible.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/70">
                    {rows.length === 0
                        ? 'Belum ada penulis.'
                        : 'Tidak ada penulis yang cocok.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[64rem] text-sm">
                        <thead>
                            <tr className="bg-forest-moss-50 text-oxford-navy-900">
                                {header('name', 'Penulis')}
                                {header('fields', 'Bidang')}
                                {header('published_books', 'Buku terbit')}
                                {header('in_process', 'Naskah proses')}
                                {header('royalty_total', 'Jumlah royalti')}
                                {header('royalty_unclaimed', 'Belum dicairkan')}
                                {header('notes', 'Catatan')}
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
                                    </td>
                                    <td className="p-2 max-w-[11rem]">
                                        {row.fields.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {row.fields.map((field) => (
                                                    <span
                                                        key={field}
                                                        className="rounded-full bg-white px-2 py-0.5 text-xs text-oxford-navy-800 ring-1 ring-forest-moss-200"
                                                    >
                                                        {field}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-oxford-navy-900/50">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {row.published_books}
                                    </td>
                                    <td className="p-2">{row.in_process}</td>
                                    <td className="p-2 whitespace-nowrap">
                                        {rupiah.format(row.royalty_total)}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                        {rupiah.format(row.royalty_unclaimed)}
                                    </td>
                                    <td className="p-2 min-w-[20rem]">
                                        {row.notes.length > 0 ? (
                                            <ul className="flex flex-col gap-1.5">
                                                {row.notes.map(
                                                    (note, index) => (
                                                        <NoteItem
                                                            key={`${note.type}-${note.title}-${index}`}
                                                            note={note}
                                                        />
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <span className="text-xs text-oxford-navy-900/50">
                                                Tidak ada yang tertunda.
                                            </span>
                                        )}
                                        <AdminNote
                                            key={`${row.id}-${row.admin_note ?? ''}`}
                                            row={row}
                                            onSaved={(note) =>
                                                setRows((current) =>
                                                    (current ?? []).map(
                                                        (item) =>
                                                            item.id === row.id
                                                                ? {
                                                                      ...item,
                                                                      admin_note:
                                                                          note,
                                                                  }
                                                                : item
                                                    )
                                                )
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
