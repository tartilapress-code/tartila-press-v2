import { useCallback, useState, type FormEvent } from 'react';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';

const GROUPS: { type: api.AdminTerm['type']; title: string; hint: string }[] = [
    {
        type: 'education_field',
        title: 'Bidang pendidikan',
        hint: 'Untuk buku non fiksi.',
    },
    {
        type: 'category',
        title: 'Kategori buku',
        hint: 'Untuk fiksi dan non fiksi (bisa dibatasi per jenis pustaka).',
    },
    { type: 'genre', title: 'Genre', hint: 'Untuk buku fiksi.' },
];

const field =
    'h-10 rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm';

function Group({
    group,
    terms,
    onChanged,
}: {
    group: (typeof GROUPS)[number];
    terms: api.AdminTerm[];
    onChanged: () => void;
}) {
    const [name, setName] = useState<string>('');
    const [pustaka, setPustaka] = useState<string>('');
    const [editing, setEditing] = useState<{
        id: number;
        name: string;
        pustaka: string;
    } | null>(null);
    const [message, setMessage] = useState<string>('');

    async function run(task: () => Promise<unknown>) {
        setMessage('');

        try {
            await task();
            onChanged();
        } catch (caught) {
            setMessage(describeApiError(caught));
        }
    }

    function add(event: FormEvent) {
        event.preventDefault();
        void run(async () => {
            await api.adminSaveTerm({
                type: group.type,
                name: name.trim(),
                pustaka:
                    group.type === 'category' && pustaka
                        ? (pustaka as api.Pustaka)
                        : null,
            });
            setName('');
        });
    }

    return (
        <section className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100">
            <div>
                <h2 className="font-display text-lg font-bold text-oxford-navy-700">
                    {group.title}
                </h2>
                <p className="text-xs text-oxford-navy-900/60">{group.hint}</p>
            </div>

            <ul className="flex flex-col gap-1.5">
                {terms.map((term) => (
                    <li
                        key={term.id}
                        className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-forest-moss-100"
                    >
                        {editing?.id === term.id ? (
                            <>
                                <input
                                    aria-label="Nama"
                                    className={`${field} min-w-0 flex-1`}
                                    value={editing.name}
                                    onChange={(e) =>
                                        setEditing({
                                            ...editing,
                                            name: e.target.value,
                                        })
                                    }
                                />
                                {group.type === 'category' && (
                                    <select
                                        aria-label="Berlaku untuk"
                                        className={field}
                                        value={editing.pustaka}
                                        onChange={(e) =>
                                            setEditing({
                                                ...editing,
                                                pustaka: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Semua</option>
                                        <option value="fiksi">Fiksi</option>
                                        <option value="non_fiksi">
                                            Non fiksi
                                        </option>
                                    </select>
                                )}
                                <button
                                    type="button"
                                    className="font-semibold text-forest-moss-700 hover:cursor-pointer"
                                    onClick={() =>
                                        void run(async () => {
                                            await api.adminSaveTerm(
                                                {
                                                    type: term.type,
                                                    name: editing.name.trim(),
                                                    pustaka: editing.pustaka
                                                        ? (editing.pustaka as api.Pustaka)
                                                        : null,
                                                },
                                                term.id
                                            );
                                            setEditing(null);
                                        })
                                    }
                                >
                                    Simpan
                                </button>
                                <button
                                    type="button"
                                    className="text-oxford-navy-900/60 hover:cursor-pointer"
                                    onClick={() => setEditing(null)}
                                >
                                    Batal
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="min-w-0 flex-1 truncate text-oxford-navy-900">
                                    {term.name}
                                    {term.pustaka && (
                                        <span className="ml-2 text-xs text-oxford-navy-900/55">
                                            (
                                            {term.pustaka === 'fiksi'
                                                ? 'fiksi'
                                                : 'non fiksi'}
                                            )
                                        </span>
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className="text-forest-moss-700 hover:cursor-pointer"
                                    onClick={() =>
                                        setEditing({
                                            id: term.id,
                                            name: term.name,
                                            pustaka: term.pustaka ?? '',
                                        })
                                    }
                                >
                                    Ubah
                                </button>
                                <button
                                    type="button"
                                    className="text-red-600 hover:cursor-pointer"
                                    onClick={() =>
                                        window.confirm(
                                            `Hapus "${term.name}"? Buku yang memakainya jadi tanpa pilihan ini.`
                                        ) &&
                                        void run(() =>
                                            api.adminDeleteTerm(term.id)
                                        )
                                    }
                                >
                                    Hapus
                                </button>
                            </>
                        )}
                    </li>
                ))}
                {terms.length === 0 && (
                    <li className="text-sm text-oxford-navy-900/55">
                        Belum ada pilihan.
                    </li>
                )}
            </ul>

            <form onSubmit={add} className="flex flex-wrap gap-2">
                <input
                    aria-label={`Tambah ${group.title}`}
                    placeholder="Nama baru"
                    className={`${field} min-w-0 flex-1`}
                    value={name}
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                />
                {group.type === 'category' && (
                    <select
                        aria-label="Berlaku untuk"
                        className={field}
                        value={pustaka}
                        onChange={(e) => setPustaka(e.target.value)}
                    >
                        <option value="">Fiksi & non fiksi</option>
                        <option value="fiksi">Fiksi saja</option>
                        <option value="non_fiksi">Non fiksi saja</option>
                    </select>
                )}
                <Button
                    type="submit"
                    disabled={name.trim().length < 2}
                    className="h-10 py-0"
                >
                    Tambah
                </Button>
            </form>
            {message && (
                <p role="alert" className="text-xs text-red-600">
                    {message}
                </p>
            )}
        </section>
    );
}

/** Admin: pilihan bidang pendidikan, kategori buku, dan genre. */
export default function AdminTermsPage() {
    const { data, error, reload } = useLoad(
        useCallback(() => api.adminTerms(), [])
    );

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Taksonomi
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Pilihan klasifikasi buku. Non fiksi: bidang pendidikan,
                    kategori, bahasa. Fiksi: kategori, genre, batas usia,
                    bahasa.
                </p>
            </div>
            {error && <p className="text-red-600">{error}</p>}
            <div className="grid gap-4 lg:grid-cols-3">
                {GROUPS.map((group) => (
                    <Group
                        key={group.type}
                        group={group}
                        terms={(data?.data ?? []).filter(
                            (term) => term.type === group.type
                        )}
                        onChanged={reload}
                    />
                ))}
            </div>
        </div>
    );
}
