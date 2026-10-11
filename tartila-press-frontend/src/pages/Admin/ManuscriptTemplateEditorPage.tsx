import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import SchemaFieldInput from '@/components/manuscriptTemplate/SchemaFieldInput';
import TemplatePreview, {
    type PreviewMode,
} from '@/components/manuscriptTemplate/TemplatePreview';
import * as templateApi from '@/data/manuscriptTemplate/manuscriptTemplateApi';
import { describeApiError } from '@/lib/apiErrors';

const cardClass =
    'flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-5';

const PREVIEW_MODE: Record<string, PreviewMode> = {
    awal: 'front',
    penutup: 'back',
};

/** /admin/manuscript-templates/new dan /admin/manuscript-templates/:id */
export default function ManuscriptTemplateEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [meta, setMeta] = useState<templateApi.TemplateMeta | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);
    const [name, setName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isActive, setIsActive] = useState<boolean>(true);
    const [config, setConfig] = useState<templateApi.TemplateConfig>({});
    const [tab, setTab] = useState<string>('umum');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [loadError, setLoadError] = useState<string>('');

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            templateApi.meta(),
            id ? templateApi.get(id) : Promise.resolve(null),
        ])
            .then(([metaResponse, templateResponse]) => {
                if (cancelled) {
                    return;
                }

                const loadedMeta: templateApi.TemplateMeta = metaResponse.data;
                setMeta(loadedMeta);

                if (templateResponse) {
                    const template: templateApi.ManuscriptTemplate =
                        templateResponse.data;
                    setName(template.name);
                    setDescription(template.description ?? '');
                    setIsActive(template.is_active);
                    setConfig(template.config);
                } else {
                    setName('');
                    setDescription('');
                    setIsActive(true);
                    setConfig(loadedMeta.defaults);
                }

                setLoadedId(id ?? 'new');
            })
            .catch((caught) => {
                if (!cancelled) {
                    setLoadError(
                        describeApiError(caught, 'Template tidak bisa dimuat.')
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    if (loadError) {
        return (
            <div className={cardClass}>
                <p role="alert" className="text-red-600 text-sm">
                    {loadError}
                </p>
                <Link
                    to="/admin/manuscript-templates"
                    className="text-forest-moss-700 self-start text-sm underline"
                >
                    Kembali ke daftar template
                </Link>
            </div>
        );
    }

    if (!meta || loadedId !== (id ?? 'new')) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    const groups = meta.groups.filter((group) => group.tab === tab);
    const format = templateApi.getPath<string>(config, 'page.format') ?? 'A5';

    // Memilih format baku langsung mengisi lebar dan tinggi halaman.
    function changeField(
        current: templateApi.TemplateConfig,
        path: string,
        value: unknown
    ): templateApi.TemplateConfig {
        let next = templateApi.setPath(current, path, value);

        if (path === 'page.format' && meta) {
            const preset = meta.page_formats[String(value)];

            if (preset && preset.w !== null && preset.h !== null) {
                next = templateApi.setPath(next, 'page.width_mm', preset.w);
                next = templateApi.setPath(next, 'page.height_mm', preset.h);
            }
        }

        return next;
    }

    async function save() {
        setIsSaving(true);
        setMessage('');
        setIsError(false);

        const payload = {
            name,
            description: description || null,
            is_active: isActive,
            config,
        };

        try {
            if (id) {
                await templateApi.update(Number(id), payload);
                setMessage('Template disimpan.');
            } else {
                const response = await templateApi.create(payload);
                navigate(`/admin/manuscript-templates/${response.data.id}`, {
                    replace: true,
                });
            }
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <Link
                to="/admin/manuscript-templates"
                className="text-forest-moss-700 hover:text-forest-moss-800 self-start text-sm"
            >
                ← Kembali ke Template Naskah
            </Link>

            <div className={cardClass}>
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {id ? 'Ubah Template Naskah' : 'Template Naskah Baru'}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Nama template
                        <input
                            className="w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500"
                            value={name}
                            maxLength={150}
                            placeholder="mis. Buku Ajar A5 Klasik"
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Deskripsi singkat (dilihat penulis saat memilih)
                        <input
                            className="w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500"
                            value={description}
                            maxLength={1000}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>
                </div>
                <label className="flex flex-row items-center gap-2 text-sm text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                    />
                    Aktif (bisa dipilih penulis)
                </label>
                <div className="flex flex-row flex-wrap items-center gap-3">
                    <Button
                        variant="primary"
                        onClick={save}
                        disabled={isSaving || name.trim() === ''}
                    >
                        {isSaving ? 'Menyimpan...' : 'Simpan template'}
                    </Button>
                    {message && (
                        <p
                            className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                        >
                            {message}
                        </p>
                    )}
                </div>
            </div>

            <div
                role="tablist"
                className="flex flex-row flex-wrap gap-2 border-b border-forest-moss-100 pb-3"
            >
                {Object.entries(meta.tabs).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:cursor-pointer ${
                            tab === key
                                ? 'bg-oxford-navy-700 text-white'
                                : 'text-oxford-navy-700 hover:bg-forest-moss-50'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                <div className="flex flex-col gap-5">
                    {groups.map((group) => (
                        <div key={group.key} className={cardClass}>
                            <h6 className="font-display text-oxford-navy-700 text-base font-bold">
                                {group.title}
                            </h6>
                            {group.description && (
                                <p className="text-oxford-navy-900/60 text-xs">
                                    {group.description}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.fields.map((field) => (
                                    <SchemaFieldInput
                                        key={field.path}
                                        field={field}
                                        meta={meta}
                                        value={templateApi.getPath(
                                            config,
                                            field.path
                                        )}
                                        disabled={
                                            (field.path === 'page.width_mm' ||
                                                field.path ===
                                                    'page.height_mm') &&
                                            format !== 'custom'
                                        }
                                        onChange={(value) =>
                                            setConfig((current) =>
                                                changeField(
                                                    current,
                                                    field.path,
                                                    value
                                                )
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`${cardClass} xl:sticky xl:top-4`}>
                    <h6 className="font-display text-oxford-navy-700 text-base font-bold">
                        Pratinjau
                    </h6>
                    <p className="text-oxford-navy-900/60 text-xs">
                        Ilustrasi dengan ukuran halaman sebenarnya. Garis putus
                        = batas margin.
                    </p>
                    <TemplatePreview
                        config={config}
                        meta={meta}
                        mode={PREVIEW_MODE[tab] ?? 'body'}
                    />
                </div>
            </div>
        </div>
    );
}
