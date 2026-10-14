import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Select from '@/components/Select/Select';
import DifficultyBadge from '@/components/manuscript/DifficultyBadge';
import FieldCategoryPicker from '@/components/manuscript/FieldCategoryPicker';
import * as adminApi from '@/data/admin/adminApi';
import { describeApiError } from '@/lib/apiErrors';
import {
    DIFFICULTY_OPTIONS,
    isDifficulty,
    type ManuscriptDifficulty,
} from '@/lib/manuscriptDifficulty';

type FieldCategory = { id: number; name: string };

type PoolEditor = {
    id: number;
    name: string;
    is_available: boolean;
    // Editor yang bersedia menjadi co-author (layanan co-author).
    is_coauthor?: boolean;
    field_category_ids: number[];
};

type PoolCoauthorManuscript = {
    id: number;
    title: string;
    authors: string[];
    difficulty: ManuscriptDifficulty | null;
    coauthor_fee: number | null;
    coauthor_deadline: string | null;
    criteria: { general: boolean; field_categories: FieldCategory[] };
    eligible_coauthor_count: number;
};

type PoolManuscript = {
    id: number;
    title: string;
    authors: string[];
    difficulty: ManuscriptDifficulty | null;
    editor_fee: number | null;
    editor_deadline: string | null;
    pool_field_category_ids: number[];
    criteria: { general: boolean; field_categories: FieldCategory[] };
    eligible_editor_count: number;
};

type PoolSettings = {
    field_categories: FieldCategory[];
    editors: PoolEditor[];
    manuscripts: PoolManuscript[];
    coauthor_manuscripts?: PoolCoauthorManuscript[];
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6';

function sameIds(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Pengaturan pool naskah:
 * - bidang keahlian tiap editor (kriteria siapa yang boleh mengambil naskah);
 * - naskah yang sedang terbuka di pool: tingkat kesulitan & kriteria editor.
 */
export default function ManuscriptPoolSettingsPage() {
    const [settings, setSettings] = useState<PoolSettings | null>(null);
    const [loadError, setLoadError] = useState<string>('');
    const [message, setMessage] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    // Isian yang belum disimpan, per editor / per naskah.
    const [editorDrafts, setEditorDrafts] = useState<Record<number, number[]>>(
        {}
    );
    const [manuscriptDrafts, setManuscriptDrafts] = useState<
        Record<
            number,
            { difficulty: ManuscriptDifficulty | ''; fields: number[] }
        >
    >({});

    function load() {
        return adminApi
            .getManuscriptPoolSettings()
            .then((response) => {
                setSettings(response.data);
                setEditorDrafts({});
                setManuscriptDrafts({});
            })
            .catch((failure) =>
                setLoadError(
                    describeApiError(
                        failure,
                        'Pengaturan pool tidak bisa dimuat.'
                    )
                )
            );
    }

    useEffect(() => {
        load();
    }, []);

    async function saveEditor(editor: PoolEditor) {
        const ids = editorDrafts[editor.id] ?? editor.field_category_ids;

        setBusyKey(`editor-${editor.id}`);
        setMessage(null);

        try {
            await adminApi.updateEditorFieldCategories(editor.id, ids);
            await load();
            setMessage({
                tone: 'ok',
                text: `Bidang keahlian ${editor.name} disimpan.`,
            });
        } catch (failure) {
            setMessage({ tone: 'error', text: describeApiError(failure) });
        } finally {
            setBusyKey(null);
        }
    }

    async function saveManuscript(manuscript: PoolManuscript) {
        const draft = manuscriptDrafts[manuscript.id];

        if (!draft) return;

        setBusyKey(`manuscript-${manuscript.id}`);
        setMessage(null);

        try {
            await adminApi.updateManuscriptPoolSettings(manuscript.id, {
                difficulty: draft.difficulty || null,
                pool_field_category_ids: draft.fields,
            });
            await load();
            setMessage({
                tone: 'ok',
                text: `Pengaturan "${manuscript.title}" disimpan.`,
            });
        } catch (failure) {
            setMessage({ tone: 'error', text: describeApiError(failure) });
        } finally {
            setBusyKey(null);
        }
    }

    if (loadError) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-red-600 text-sm">
                    {loadError}
                </p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className={cardClass}>
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            </div>
        );
    }

    const fieldName = new Map(
        settings.field_categories.map((category) => [
            category.id,
            category.name,
        ])
    );

    return (
        <div className="flex flex-col gap-6">
            <div className={cardClass}>
                <div className="flex flex-col gap-1">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Pengaturan Pool Naskah
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Naskah pool bisa dibuka untuk <strong>Umum</strong>{' '}
                        (semua editor) atau hanya untuk{' '}
                        <strong>bidang tertentu</strong>. Editor hanya melihat
                        dan bisa mengambil naskah yang bidangnya cocok dengan
                        bidang keahliannya di bawah ini. Tingkat kesulitan diisi
                        saat menerima naskah penulis (halaman detail naskah) dan
                        bisa diubah di sini.
                    </p>
                </div>
                {message && (
                    <p
                        role={message.tone === 'error' ? 'alert' : 'status'}
                        className={
                            message.tone === 'error'
                                ? 'text-red-600 text-sm'
                                : 'text-forest-moss-700 text-sm'
                        }
                    >
                        {message.text}
                    </p>
                )}
            </div>

            <section className={cardClass} aria-labelledby="pool-naskah">
                <h6
                    id="pool-naskah"
                    className="font-display text-lg font-bold text-oxford-navy-700"
                >
                    Naskah di Pool ({settings.manuscripts.length})
                </h6>
                {settings.manuscripts.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada naskah yang terbuka di pool. Buka naskah ke
                        pool dari halaman detail naskah (status Menunggu
                        Penugasan Editor).
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {settings.manuscripts.map((manuscript) => {
                            const draft = manuscriptDrafts[manuscript.id] ?? {
                                difficulty: manuscript.difficulty ?? '',
                                fields: manuscript.pool_field_category_ids,
                            };
                            const isDirty =
                                draft.difficulty !==
                                    (manuscript.difficulty ?? '') ||
                                !sameIds(
                                    draft.fields,
                                    manuscript.pool_field_category_ids
                                );

                            return (
                                <li
                                    key={manuscript.id}
                                    className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex flex-col gap-0.5">
                                            <Link
                                                to={`/dashboard/naskah/${manuscript.id}`}
                                                className="font-semibold text-oxford-navy-900 hover:text-oxford-navy-600"
                                            >
                                                {manuscript.title}
                                            </Link>
                                            <p className="text-sm text-oxford-navy-900/70">
                                                {manuscript.authors.join(', ')}
                                                {manuscript.editor_fee !==
                                                    null &&
                                                    ` · ${rupiahFormatter.format(manuscript.editor_fee)}`}
                                                {manuscript.editor_deadline &&
                                                    ` · deadline ${manuscript.editor_deadline}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <DifficultyBadge
                                                difficulty={
                                                    manuscript.difficulty
                                                }
                                            />
                                            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-oxford-navy-800 ring-1 ring-forest-moss-200">
                                                {manuscript.criteria.general
                                                    ? 'Umum'
                                                    : manuscript.criteria.field_categories
                                                          .map(
                                                              (item) =>
                                                                  item.name
                                                          )
                                                          .join(', ')}
                                            </span>
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                                                    manuscript.eligible_editor_count ===
                                                    0
                                                        ? 'bg-red-50 text-red-700 ring-red-200'
                                                        : 'bg-white text-oxford-navy-800 ring-forest-moss-200'
                                                }`}
                                            >
                                                {
                                                    manuscript.eligible_editor_count
                                                }{' '}
                                                editor memenuhi
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
                                        <Select
                                            name={`difficulty-${manuscript.id}`}
                                            label="Tingkat Kesulitan"
                                            option_data={[
                                                {
                                                    value: '',
                                                    label: 'Belum diisi',
                                                },
                                                ...DIFFICULTY_OPTIONS,
                                            ]}
                                            value={draft.difficulty}
                                            onChange={(event) =>
                                                setManuscriptDrafts({
                                                    ...manuscriptDrafts,
                                                    [manuscript.id]: {
                                                        ...draft,
                                                        difficulty:
                                                            isDifficulty(
                                                                event.target
                                                                    .value
                                                            )
                                                                ? event.target
                                                                      .value
                                                                : '',
                                                    },
                                                })
                                            }
                                        />
                                        <FieldCategoryPicker
                                            label="Kriteria Editor"
                                            categories={
                                                settings.field_categories
                                            }
                                            value={draft.fields}
                                            onChange={(fields) =>
                                                setManuscriptDrafts({
                                                    ...manuscriptDrafts,
                                                    [manuscript.id]: {
                                                        ...draft,
                                                        fields,
                                                    },
                                                })
                                            }
                                            emptyLabel="Umum — semua editor bisa mengambil."
                                        />
                                    </div>
                                    {isDirty && (
                                        <Button
                                            variant="primary"
                                            className="self-start"
                                            onClick={() =>
                                                saveManuscript(manuscript)
                                            }
                                            disabled={
                                                busyKey ===
                                                `manuscript-${manuscript.id}`
                                            }
                                        >
                                            Simpan
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className={cardClass} aria-labelledby="pool-coauthor">
                <div className="flex flex-col gap-1">
                    <h6
                        id="pool-coauthor"
                        className="font-display text-lg font-bold text-oxford-navy-700"
                    >
                        Naskah di Pool Co-author (
                        {(settings.coauthor_manuscripts ?? []).length})
                    </h6>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Naskah yang menunggu co-author. Hanya editor yang
                        mencentang co-author dan bidang keahliannya cocok yang
                        bisa mengambilnya. Buka naskah ke pool ini dari halaman
                        detail naskah (status Menunggu Penugasan Co-author).
                    </p>
                </div>
                {(settings.coauthor_manuscripts ?? []).length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada naskah yang terbuka di pool co-author.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {(settings.coauthor_manuscripts ?? []).map(
                            (manuscript) => (
                                <li
                                    key={manuscript.id}
                                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <Link
                                            to={`/dashboard/naskah/${manuscript.id}`}
                                            className="font-semibold text-oxford-navy-900 hover:text-oxford-navy-600"
                                        >
                                            {manuscript.title}
                                        </Link>
                                        <p className="text-sm text-oxford-navy-900/70">
                                            {manuscript.authors.join(', ')}
                                            {manuscript.coauthor_fee !== null &&
                                                ` · ${rupiahFormatter.format(manuscript.coauthor_fee)}`}
                                            {manuscript.coauthor_deadline &&
                                                ` · deadline ${manuscript.coauthor_deadline}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DifficultyBadge
                                            difficulty={manuscript.difficulty}
                                        />
                                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-oxford-navy-800 ring-1 ring-forest-moss-200">
                                            {manuscript.criteria.general
                                                ? 'Umum'
                                                : manuscript.criteria.field_categories
                                                      .map((item) => item.name)
                                                      .join(', ')}
                                        </span>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                                                manuscript.eligible_coauthor_count ===
                                                0
                                                    ? 'bg-red-50 text-red-700 ring-red-200'
                                                    : 'bg-white text-oxford-navy-800 ring-forest-moss-200'
                                            }`}
                                        >
                                            {manuscript.eligible_coauthor_count}{' '}
                                            co-author memenuhi
                                        </span>
                                    </div>
                                </li>
                            )
                        )}
                    </ul>
                )}
            </section>

            <section className={cardClass} aria-labelledby="pool-editor">
                <div className="flex flex-col gap-1">
                    <h6
                        id="pool-editor"
                        className="font-display text-lg font-bold text-oxford-navy-700"
                    >
                        Bidang Keahlian Editor ({settings.editors.length})
                    </h6>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Editor tanpa bidang keahlian hanya bisa mengambil naskah
                        Umum.
                    </p>
                </div>
                {settings.editors.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada editor.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {settings.editors.map((editor) => {
                            const draft =
                                editorDrafts[editor.id] ??
                                editor.field_category_ids;
                            const isDirty = !sameIds(
                                draft,
                                editor.field_category_ids
                            );

                            return (
                                <li
                                    key={editor.id}
                                    className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-oxford-navy-900">
                                            {editor.name}
                                        </span>
                                        {editor.is_coauthor && (
                                            <span className="rounded-full bg-forest-moss-50 px-2.5 py-0.5 text-xs font-medium text-forest-moss-800 ring-1 ring-forest-moss-200">
                                                Co-author
                                            </span>
                                        )}
                                        {!editor.is_available && (
                                            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-oxford-navy-900/70 ring-1 ring-forest-moss-200">
                                                Sedang tidak tersedia
                                            </span>
                                        )}
                                        <span className="text-xs text-oxford-navy-900/65">
                                            {editor.field_category_ids
                                                .length === 0
                                                ? 'Hanya naskah Umum'
                                                : editor.field_category_ids
                                                      .map((id) =>
                                                          fieldName.get(id)
                                                      )
                                                      .filter(Boolean)
                                                      .join(', ')}
                                        </span>
                                    </div>
                                    <FieldCategoryPicker
                                        label={`Bidang keahlian ${editor.name}`}
                                        categories={settings.field_categories}
                                        value={draft}
                                        onChange={(ids) =>
                                            setEditorDrafts({
                                                ...editorDrafts,
                                                [editor.id]: ids,
                                            })
                                        }
                                        emptyLabel="Tanpa bidang — hanya naskah Umum."
                                    />
                                    {isDirty && (
                                        <Button
                                            variant="primary"
                                            className="self-start"
                                            onClick={() => saveEditor(editor)}
                                            disabled={
                                                busyKey ===
                                                `editor-${editor.id}`
                                            }
                                        >
                                            Simpan
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
