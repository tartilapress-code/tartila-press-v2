import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiAddLine, RiImageAddLine } from '@remixicon/react';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import CertificateStage from '@/components/certificate/CertificateStage';
import FieldInspector from '@/components/certificate/FieldInspector';
import PdfPreviewModal from '@/components/certificate/PdfPreviewModal';
import * as certificateApi from '@/data/certificate/certificateApi';
import type {
    CertificateRole,
    CertificateTemplate,
    CertificateTemplateType,
    EditorMeta,
    TemplateField,
} from '@/data/certificate/certificateApi';
import { useCertificateFonts } from '@/hooks/useCertificateFonts';
import { describeApiError } from '@/lib/apiErrors';
import { withSampleAnswers } from '@/lib/certificateLayout';

type TemplateEditorProps = {
    meta: EditorMeta;
    type: CertificateTemplateType;
    /** The template being edited; null when creating a new one. */
    template: CertificateTemplate | null;
};

type EditorImage = {
    path: string;
    url: string;
    width: number;
    height: number;
};

type Message = { kind: 'error' | 'success'; text: string };

function makeId(): string {
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
}

const typeLabels: Record<CertificateTemplateType, string> = {
    event: 'Sertifikat Event',
    publication: 'Sertifikat Penulis/Editor',
    social: 'Poster Sosmed',
};

const selectClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

export default function TemplateEditor({
    meta,
    type,
    template,
}: TemplateEditorProps) {
    const navigate = useNavigate();

    const [name, setName] = useState<string>(template?.name ?? '');
    const [role, setRole] = useState<CertificateRole | ''>(
        template?.role ?? ''
    );
    const [isActive, setIsActive] = useState<boolean>(
        template?.is_active ?? true
    );
    const [image, setImage] = useState<EditorImage | null>(
        template
            ? {
                  path: template.image_path,
                  url: template.image_url,
                  width: template.image_width,
                  height: template.image_height,
              }
            : null
    );
    const [fields, setFields] = useState<TemplateField[]>(
        template?.fields ?? []
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [longSamples, setLongSamples] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [message, setMessage] = useState<Message | null>(null);

    const variables = meta.variables[type];
    const fontsVersion = useCertificateFonts(meta.fonts, fields);
    const selected = fields.find((field) => field.id === selectedId) ?? null;

    // Sample text for every {token}, so the editor shows realistic text.
    const baseValues: Record<string, string> = {};
    for (const variable of variables) {
        if (!variable.dynamic) {
            baseValues[variable.token] =
                longSamples && variable.sample_long
                    ? variable.sample_long
                    : variable.sample;
        }
    }
    if (type === 'publication' && role === 'editor') {
        baseValues.role = 'Editor';
    }
    const values = withSampleAnswers(fields, baseValues);

    function updateField(id: string, patch: Partial<TemplateField>) {
        setFields((current) =>
            current.map((field) =>
                field.id === id ? { ...field, ...patch } : field
            )
        );
    }

    function addField() {
        if (fields.length >= meta.layout.max_fields) {
            setMessage({
                kind: 'error',
                text: `Maksimal ${meta.layout.max_fields} kolom teks per templat.`,
            });

            return;
        }

        const field: TemplateField = {
            id: makeId(),
            text: '{name}',
            x: 0.2,
            y: 0.4 + Math.min(fields.length, 5) * 0.03,
            w: 0.6,
            h: 0.1,
            font: meta.default_font,
            bold: false,
            size: 36,
            color: '#1f2937',
            align: 'center',
            valign: 'middle',
            uppercase: false,
            autoFit: true,
        };

        setFields((current) => [...current, field]);
        setSelectedId(field.id);
    }

    function duplicateField(source: TemplateField) {
        if (fields.length >= meta.layout.max_fields) {
            return;
        }

        const copy: TemplateField = {
            ...source,
            id: makeId(),
            x: Math.min(source.x + 0.02, 1 - source.w),
            y: Math.min(source.y + 0.04, 1 - source.h),
        };

        setFields((current) => [...current, copy]);
        setSelectedId(copy.id);
    }

    function removeField(id: string) {
        setFields((current) => current.filter((field) => field.id !== id));
        setSelectedId(null);
    }

    async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setIsUploading(true);
        setMessage(null);

        try {
            const response = await certificateApi.adminUploadImage(file);
            setImage(response.data);
        } catch (error) {
            setMessage({
                kind: 'error',
                text: describeApiError(error, 'Gagal mengunggah gambar.'),
            });
        } finally {
            setIsUploading(false);
        }
    }

    async function handleSave() {
        if (!image) {
            return;
        }

        setIsSaving(true);
        setMessage(null);

        const payload = {
            name,
            role: type === 'publication' ? role || null : null,
            image_path: image.path,
            is_active: isActive,
            fields,
        };

        try {
            if (template) {
                await certificateApi.adminUpdate(template.id, payload);
                setMessage({ kind: 'success', text: 'Templat tersimpan.' });
            } else {
                const response = await certificateApi.adminCreate({
                    ...payload,
                    type,
                });
                navigate(`/admin/certificate-templates/${response.data.id}`, {
                    replace: true,
                    state: { saved: true },
                });
            }
        } catch (error) {
            setMessage({ kind: 'error', text: describeApiError(error) });
        } finally {
            setIsSaving(false);
        }
    }

    async function handlePreview() {
        if (!image) {
            return;
        }

        setIsPreviewing(true);
        setMessage(null);

        try {
            const { blob } = await certificateApi.adminPreview({
                type,
                role: role || null,
                image_path: image.path,
                fields,
                long: longSamples,
            });

            setPreviewUrl(URL.createObjectURL(blob));
        } catch (error) {
            setMessage({
                kind: 'error',
                text: describeApiError(error, 'Gagal membuat pratinjau.'),
            });
        } finally {
            setIsPreviewing(false);
        }
    }

    function closePreview() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(null);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        {template ? 'Ubah Templat' : 'Templat Baru'} —{' '}
                        {typeLabels[type]}
                    </h5>
                    <Link
                        to="/admin/certificate-templates"
                        className="text-forest-moss-700 hover:text-forest-moss-800 text-sm underline"
                    >
                        Kembali ke daftar templat
                    </Link>
                </div>

                <Input
                    label="Nama templat"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={
                        type === 'event'
                            ? 'mis. Sertifikat Webinar Nasional'
                            : type === 'social'
                              ? 'mis. Poster TERBIT biru'
                              : 'mis. Sertifikat Penulis'
                    }
                />

                {type === 'publication' && (
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="template-role"
                            className="text-sm font-medium text-oxford-navy-900"
                        >
                            Berlaku untuk
                        </label>
                        <select
                            id="template-role"
                            value={role}
                            onChange={(event) =>
                                setRole(
                                    event.target.value as CertificateRole | ''
                                )
                            }
                            className={selectClass}
                        >
                            <option value="">Penulis dan Editor</option>
                            <option value="author">Hanya Penulis</option>
                            <option value="editor">Hanya Editor</option>
                        </select>
                        <small className="text-oxford-navy-900/60">
                            Templat khusus satu peran didahulukan daripada
                            templat untuk semua peran. Kalau ada beberapa yang
                            aktif, yang terakhir diubah dipakai.
                        </small>
                    </div>
                )}

                <label className="flex flex-row items-center gap-2 text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(event) => setIsActive(event.target.checked)}
                    />
                    {type === 'publication'
                        ? 'Aktif (sertifikat penulis/editor terbit otomatis selama templat aktif)'
                        : type === 'social'
                          ? 'Aktif (bisa dipilih di Konten Sosmed)'
                          : 'Aktif (bisa dipilih di pengaturan absensi event)'}
                </label>

                {message && (
                    <p
                        role={message.kind === 'error' ? 'alert' : 'status'}
                        className={`text-sm ${
                            message.kind === 'error'
                                ? 'text-red-600'
                                : 'text-forest-moss-700'
                        }`}
                    >
                        {message.text}
                    </p>
                )}

                <div className="flex flex-row flex-wrap gap-2">
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={
                            isSaving ||
                            !image ||
                            name.trim() === '' ||
                            fields.length === 0
                        }
                    >
                        {isSaving ? 'Menyimpan...' : 'Simpan Templat'}
                    </Button>
                    <Button
                        variant="outline2"
                        onClick={handlePreview}
                        disabled={isPreviewing || !image || fields.length === 0}
                    >
                        {isPreviewing ? 'Membuat PDF...' : 'Pratinjau PDF'}
                    </Button>
                </div>
                {image && fields.length === 0 && (
                    <small className="text-oxford-navy-900/60">
                        Tambahkan minimal satu kolom teks sebelum menyimpan.
                    </small>
                )}
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Tandai posisi teks
                    </h5>
                    <label className="text-oxford-navy-900 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <RiImageAddLine aria-hidden className="size-5" />
                        {image
                            ? 'Ganti gambar templat'
                            : 'Unggah gambar templat'}
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleImageChange}
                            disabled={isUploading}
                            className="sr-only"
                        />
                    </label>
                </div>

                {isUploading && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Mengunggah gambar...
                    </p>
                )}

                {!image ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Mulai dengan mengunggah gambar templat sertifikat (JPG
                        atau PNG, maks 10 MB; mis. hasil ekspor dari Canva).
                        Setelah itu tambahkan kolom teks, tarik ke tempat yang
                        kosong, lalu atur isi dan hurufnya.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="flex flex-col gap-3">
                            <CertificateStage
                                imageUrl={image.url}
                                imageWidth={image.width}
                                imageHeight={image.height}
                                fields={fields}
                                values={values}
                                meta={meta}
                                fontsVersion={fontsVersion}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onChange={updateField}
                            />

                            <div className="flex flex-row flex-wrap items-center gap-3">
                                <Button variant="secondary" onClick={addField}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <RiAddLine
                                            aria-hidden
                                            className="size-4"
                                        />
                                        Tambah kolom teks
                                    </span>
                                </Button>
                                <label className="text-oxford-navy-900 flex flex-row items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={longSamples}
                                        onChange={(event) =>
                                            setLongSamples(event.target.checked)
                                        }
                                    />
                                    Uji dengan teks panjang
                                </label>
                            </div>

                            <p className="text-oxford-navy-900/60 text-xs">
                                Tarik kotak untuk memindahkan, tarik sudut kanan
                                bawahnya untuk mengubah ukuran. Tombol panah
                                menggeser kotak yang dipilih (Shift = lebih
                                jauh). Teks di sini hanya contoh; di sertifikat
                                sungguhan diganti data penerimanya.
                            </p>

                            {fields.length > 0 && (
                                <ul className="flex flex-row flex-wrap gap-2">
                                    {fields.map((field, index) => (
                                        <li key={field.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedId(field.id)
                                                }
                                                aria-pressed={
                                                    field.id === selectedId
                                                }
                                                className={`max-w-48 truncate rounded-full px-3 py-1 text-xs font-medium ${
                                                    field.id === selectedId
                                                        ? 'bg-forest-moss-600 text-white'
                                                        : 'bg-forest-moss-100 text-forest-moss-800 hover:bg-forest-moss-200'
                                                }`}
                                            >
                                                {index + 1}.{' '}
                                                {field.text.trim() ||
                                                    '(kosong)'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <aside className="lg:sticky lg:top-4 lg:self-start">
                            {selected ? (
                                <FieldInspector
                                    key={selected.id}
                                    field={selected}
                                    fonts={meta.fonts}
                                    variables={variables}
                                    type={type}
                                    onChange={(patch) =>
                                        updateField(selected.id, patch)
                                    }
                                    onDuplicate={() => duplicateField(selected)}
                                    onDelete={() => removeField(selected.id)}
                                />
                            ) : (
                                <p className="text-oxford-navy-900/70 rounded-lg bg-forest-moss-50 p-4 text-sm">
                                    Pilih sebuah kolom teks di gambar (atau
                                    tambahkan yang baru) untuk mengatur isi,
                                    font, ukuran, warna, dan posisinya.
                                </p>
                            )}
                        </aside>
                    </div>
                )}
            </div>

            {previewUrl && (
                <PdfPreviewModal
                    url={previewUrl}
                    title="Pratinjau sertifikat"
                    onClose={closePreview}
                />
            )}
        </div>
    );
}
