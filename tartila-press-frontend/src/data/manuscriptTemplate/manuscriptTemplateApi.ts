import { http } from '@/lib/http';

export type FieldType =
    | 'number'
    | 'text'
    | 'textarea'
    | 'select'
    | 'toggle'
    | 'color'
    | 'font'
    | 'order';

export type SchemaField = {
    path: string;
    label: string;
    type: FieldType;
    default: unknown;
    help: string | null;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: Record<string, string>;
};

export type SchemaGroup = {
    key: string;
    tab: string;
    title: string;
    description: string | null;
    fields: SchemaField[];
};

export type TemplateConfig = Record<string, unknown>;

export type TemplateMeta = {
    tabs: Record<string, string>;
    groups: SchemaGroup[];
    defaults: TemplateConfig;
    fonts: string[];
    page_formats: Record<
        string,
        { label: string; w: number | null; h: number | null }
    >;
    front_items: Record<string, string>;
    body_items: Record<string, string>;
    back_items: Record<string, string>;
};

export type ManuscriptTemplate = {
    id: number;
    name: string;
    description: string | null;
    config: TemplateConfig;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export type TemplatePayload = {
    name: string;
    description?: string | null;
    is_active?: boolean;
    config?: TemplateConfig;
};

export const meta = () => http.get('/admin/manuscript-templates/meta');

export const list = () => http.get('/admin/manuscript-templates');

export const get = (id: number | string) =>
    http.get(`/admin/manuscript-templates/${id}`);

export const create = (payload: TemplatePayload) =>
    http.post('/admin/manuscript-templates', payload);

export const update = (id: number, payload: Partial<TemplatePayload>) =>
    http.patch(`/admin/manuscript-templates/${id}`, payload);

export const duplicate = (id: number) =>
    http.post(`/admin/manuscript-templates/${id}/duplicate`);

export const makeDefault = (id: number) =>
    http.post(`/admin/manuscript-templates/${id}/make-default`);

/** Unduh hasil auto layout naskah (tidak disimpan). */
export const autoLayoutPreview = (
    manuscriptId: number,
    revisionId: number,
    templateId: number | null
) =>
    http.fetchFile(
        `/admin/manuscripts/${manuscriptId}/revisions/${revisionId}/auto-layout${templateId ? `?template_id=${templateId}` : ''}`
    );

export const remove = (id: number) =>
    http.delete(`/admin/manuscript-templates/${id}`);

// --- helper path "a.b.c" pada objek konfigurasi -----------------------------

export function getPath<T = unknown>(
    config: TemplateConfig,
    path: string
): T | undefined {
    return path
        .split('.')
        .reduce<unknown>(
            (node, key) =>
                node !== null && typeof node === 'object'
                    ? (node as Record<string, unknown>)[key]
                    : undefined,
            config
        ) as T | undefined;
}

/** Salinan config dengan nilai di `path` diganti (objek lain dipakai bersama). */
export function setPath(
    config: TemplateConfig,
    path: string,
    value: unknown
): TemplateConfig {
    const [head, ...rest] = path.split('.');

    if (rest.length === 0) {
        return { ...config, [head]: value };
    }

    return {
        ...config,
        [head]: setPath(
            (config[head] as TemplateConfig | undefined) ?? {},
            rest.join('.'),
            value
        ),
    };
}
