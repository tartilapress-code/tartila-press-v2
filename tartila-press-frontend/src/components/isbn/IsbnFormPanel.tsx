import { useState } from 'react';
import Button from '@/components/Button/Button';
import IsbnAttachmentsBox from '@/components/isbn/IsbnAttachmentsBox';
import * as isbnApi from '@/data/isbn/isbnApi';
import { describeApiError } from '@/lib/apiErrors';

type Form = isbnApi.IsbnForm;

const OPTIONS: Record<string, Record<string, string>> = {
    request_type: { lepas: 'Lepas', jilid: 'Jilid' },
    media: { cetak: 'Cetak', pdf: 'PDF', epub: 'Epub' },
    reader_group: { anak: 'Anak', dewasa: 'Dewasa', semua_umur: 'Semua umur' },
    literature_type: { fiksi: 'Fiksi', non_fiksi: 'Non fiksi' },
    translation: {
        terjemahan: 'Terjemahan',
        non_terjemahan: 'Non terjemahan',
    },
    kdt: { ya: 'Ya, prioritaskan pengajuan KDT kami.', tidak: 'Tidak' },
    illustrations: { ya: 'Ya', tidak: 'Tidak' },
};

type FieldDef = {
    key: keyof Form;
    label: string;
    kind: 'text' | 'select' | 'authors' | 'long' | 'number';
};

const FIELDS: FieldDef[] = [
    { key: 'request_type', label: 'Jenis Permohonan ISBN', kind: 'select' },
    { key: 'title', label: 'Judul Buku', kind: 'text' },
    { key: 'authors', label: 'Penulis', kind: 'authors' },
    { key: 'editor', label: 'Editor', kind: 'text' },
    { key: 'designer', label: 'Desainer', kind: 'text' },
    { key: 'media', label: 'Media Terbitan ISBN', kind: 'select' },
    { key: 'reader_group', label: 'Kelompok Pembaca', kind: 'select' },
    { key: 'literature_type', label: 'Jenis Pustaka', kind: 'select' },
    { key: 'translation', label: 'Kategori Jenis Pustaka', kind: 'select' },
    {
        key: 'kdt',
        label: 'Memerlukan Katalog Dalam Terbitan (KDT)?',
        kind: 'select',
    },
    {
        key: 'estimated_publish',
        label: 'Perkiraan Bulan & Tahun Terbit',
        kind: 'text',
    },
    { key: 'province', label: 'Provinsi Tempat Terbit Buku', kind: 'text' },
    { key: 'city', label: 'Kota/Kabupaten Tempat Terbit', kind: 'text' },
    { key: 'distributor', label: 'Distributor', kind: 'text' },
    { key: 'description', label: 'Deskripsi / Abstrak Buku', kind: 'long' },
    { key: 'pages', label: 'Jumlah Halaman', kind: 'number' },
    { key: 'height_cm', label: 'Tinggi Buku (cm)', kind: 'number' },
    { key: 'edition', label: 'Edisi Buku', kind: 'text' },
    { key: 'series', label: 'Seri Buku', kind: 'text' },
    {
        key: 'illustrations',
        label: 'Ada ilustrasi dalam terbitan?',
        kind: 'select',
    },
    {
        key: 'publication_url',
        label: 'URL / Link Publikasi Buku',
        kind: 'text',
    },
];

const fieldClass =
    'w-full rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

function display(def: FieldDef, form: Form): string {
    const value = form[def.key];

    if (Array.isArray(value)) {
        return value.join('\n');
    }

    if (value === null || value === undefined || value === '') {
        return '';
    }

    return def.kind === 'select'
        ? (OPTIONS[def.key]?.[String(value)] ?? String(value))
        : String(value);
}

/**
 * Data pengisian formulir pengajuan ISBN untuk admin: nilai terisi otomatis
 * dari naskah/buku, bisa diubah, disalin per kolom, dan lampiran (dummy,
 * cover) bisa diunduh.
 */
export default function IsbnFormPanel({
    application,
    onSaved,
}: {
    application: isbnApi.IsbnApplication & {
        form: Form;
        attachments: isbnApi.IsbnAttachments;
    };
    onSaved: () => Promise<unknown>;
}) {
    const [editing, setEditing] = useState<boolean>(false);
    const [draft, setDraft] = useState<Form>(application.form);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const form = application.form;

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setIsError(false);
            setMessage('Disalin.');
        } catch {
            setIsError(true);
            setMessage('Gagal menyalin. Salin manual.');
        }
    }

    async function save() {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            await isbnApi.adminSaveForm(application.id, {
                ...draft,
                authors: draft.authors.filter((name) => name.trim() !== ''),
                pages: draft.pages === null ? null : Number(draft.pages),
                height_cm:
                    draft.height_cm === null ? null : Number(draft.height_cm),
            });
            await onSaved();
            setEditing(false);
            setMessage('Data pengisian disimpan.');
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    function setField(key: keyof Form, value: unknown) {
        setDraft((prev) => ({ ...prev, [key]: value }) as Form);
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-white ring-1 ring-forest-moss-100 p-4">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <p className="text-oxford-navy-900 text-sm font-semibold">
                    Data pengisian pengajuan ISBN
                </p>
                <div className="flex flex-row gap-2">
                    <Button
                        variant="outline2"
                        onClick={() =>
                            copy(
                                FIELDS.map(
                                    (def) =>
                                        `${def.label}: ${display(def, form)}`
                                ).join('\n')
                            )
                        }
                    >
                        Salin semua
                    </Button>
                    {editing ? (
                        <Button
                            variant="outline2"
                            onClick={() => setEditing(false)}
                        >
                            Batal
                        </Button>
                    ) : (
                        <Button
                            variant="outline2"
                            onClick={() => {
                                setDraft(form);
                                setEditing(true);
                            }}
                        >
                            Ubah
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col divide-y divide-forest-moss-100">
                {FIELDS.map((def) => (
                    <div
                        key={def.key}
                        className="grid grid-cols-1 sm:grid-cols-[13rem_1fr_auto] gap-x-3 gap-y-1 py-2 items-start"
                    >
                        <p className="text-oxford-navy-900/60 text-xs pt-1">
                            {def.label}
                        </p>

                        {editing ? (
                            <FieldInput
                                def={def}
                                draft={draft}
                                onChange={setField}
                            />
                        ) : (
                            <p className="text-oxford-navy-900 text-sm whitespace-pre-line break-words">
                                {display(def, form) || (
                                    <span className="text-amber-700">
                                        Belum diisi
                                    </span>
                                )}
                            </p>
                        )}

                        {!editing && display(def, form) && (
                            <button
                                type="button"
                                className="text-forest-moss-700 text-xs hover:underline hover:cursor-pointer justify-self-start"
                                onClick={() => copy(display(def, form))}
                            >
                                Salin
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {editing && (
                <Button
                    variant="primary"
                    className="self-start"
                    onClick={save}
                    disabled={isBusy}
                >
                    {isBusy ? 'Menyimpan...' : 'Simpan data pengisian'}
                </Button>
            )}

            <IsbnAttachmentsBox
                application={application}
                title={form.title || application.title}
                onProcessed={onSaved}
            />

            {message && (
                <p
                    className={`text-xs ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}
        </div>
    );
}

function FieldInput({
    def,
    draft,
    onChange,
}: {
    def: FieldDef;
    draft: Form;
    onChange: (key: keyof Form, value: unknown) => void;
}) {
    const value = draft[def.key];

    if (def.kind === 'select') {
        return (
            <select
                className={fieldClass}
                value={(value as string | null) ?? ''}
                onChange={(e) => onChange(def.key, e.target.value || null)}
            >
                <option value="">— pilih —</option>
                {Object.entries(OPTIONS[def.key]).map(
                    ([optionValue, label]) => (
                        <option key={optionValue} value={optionValue}>
                            {label}
                        </option>
                    )
                )}
            </select>
        );
    }

    if (def.kind === 'authors') {
        return (
            <textarea
                rows={3}
                className={fieldClass}
                placeholder="Satu penulis per baris"
                value={(value as string[]).join('\n')}
                onChange={(e) => onChange(def.key, e.target.value.split('\n'))}
            />
        );
    }

    if (def.kind === 'long') {
        return (
            <textarea
                rows={4}
                className={fieldClass}
                value={(value as string | null) ?? ''}
                onChange={(e) => onChange(def.key, e.target.value || null)}
            />
        );
    }

    return (
        <input
            className={fieldClass}
            type={def.kind === 'number' ? 'number' : 'text'}
            value={(value as string | number | null) ?? ''}
            onChange={(e) => onChange(def.key, e.target.value || null)}
        />
    );
}
