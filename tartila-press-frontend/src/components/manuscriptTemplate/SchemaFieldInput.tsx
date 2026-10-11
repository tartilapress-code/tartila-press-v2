import type {
    SchemaField,
    TemplateMeta,
} from '@/data/manuscriptTemplate/manuscriptTemplateApi';

const inputClass =
    'w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30 disabled:bg-forest-moss-50 disabled:text-oxford-navy-900/55';

/** Satu kolom pengaturan template, digambar menurut jenisnya dari skema backend. */
export default function SchemaFieldInput({
    field,
    value,
    onChange,
    meta,
    disabled = false,
}: {
    field: SchemaField;
    value: unknown;
    onChange: (value: unknown) => void;
    meta: TemplateMeta;
    disabled?: boolean;
}) {
    const id = `f-${field.path}`;

    if (field.type === 'toggle') {
        return (
            <div className="flex flex-col gap-1 sm:col-span-2">
                <label
                    htmlFor={id}
                    className="flex flex-row items-center gap-2 text-sm text-oxford-navy-900"
                >
                    <input
                        id={id}
                        type="checkbox"
                        checked={Boolean(value)}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.checked)}
                    />
                    {field.label}
                </label>
                {field.help && (
                    <p className="text-oxford-navy-900/55 text-xs">
                        {field.help}
                    </p>
                )}
            </div>
        );
    }

    if (field.type === 'order') {
        const keys = (value as string[] | undefined) ?? [];
        const options = field.options ?? {};

        const move = (index: number, delta: number) => {
            const next = [...keys];
            const target = index + delta;

            if (target < 0 || target >= next.length) {
                return;
            }

            [next[index], next[target]] = [next[target], next[index]];
            onChange(next);
        };

        return (
            <div className="flex flex-col gap-2 sm:col-span-2">
                <p className="text-sm font-medium text-oxford-navy-900">
                    {field.label}
                </p>
                <ol className="flex flex-col gap-1">
                    {keys.map((key, index) => (
                        <li
                            key={key}
                            className="flex flex-row items-center justify-between gap-2 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 px-3 py-2 text-sm"
                        >
                            <span className="text-oxford-navy-900">
                                {index + 1}. {options[key] ?? key}
                            </span>
                            <span className="flex flex-row gap-1">
                                <button
                                    type="button"
                                    aria-label={`Naikkan ${options[key] ?? key}`}
                                    disabled={index === 0}
                                    onClick={() => move(index, -1)}
                                    className="rounded px-2 text-oxford-navy-700 hover:bg-forest-moss-100 disabled:opacity-30 hover:cursor-pointer"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Turunkan ${options[key] ?? key}`}
                                    disabled={index === keys.length - 1}
                                    onClick={() => move(index, 1)}
                                    className="rounded px-2 text-oxford-navy-700 hover:bg-forest-moss-100 disabled:opacity-30 hover:cursor-pointer"
                                >
                                    ↓
                                </button>
                            </span>
                        </li>
                    ))}
                </ol>
                {field.help && (
                    <p className="text-oxford-navy-900/55 text-xs">
                        {field.help}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col gap-1 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}
        >
            <label htmlFor={id} className="text-xs text-oxford-navy-900/70">
                {field.label}
                {field.unit ? ` (${field.unit})` : ''}
            </label>

            {field.type === 'number' && (
                <input
                    id={id}
                    type="number"
                    className={inputClass}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    disabled={disabled}
                    value={
                        value === undefined || value === null
                            ? ''
                            : String(value)
                    }
                    onChange={(e) =>
                        onChange(
                            e.target.value === '' ? '' : Number(e.target.value)
                        )
                    }
                />
            )}

            {field.type === 'select' && (
                <select
                    id={id}
                    className={inputClass}
                    disabled={disabled}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {Object.entries(field.options ?? {}).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </select>
            )}

            {field.type === 'font' && (
                <select
                    id={id}
                    className={inputClass}
                    value={String(value ?? '')}
                    style={{ fontFamily: String(value ?? '') }}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {meta.fonts.map((font) => (
                        <option key={font} value={font}>
                            {font}
                        </option>
                    ))}
                </select>
            )}

            {field.type === 'color' && (
                <div className="flex flex-row items-center gap-2">
                    <input
                        id={id}
                        type="color"
                        className="h-9 w-12 cursor-pointer rounded border border-oxford-navy-900/15 bg-white"
                        value={String(value ?? '#000000')}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <span className="text-oxford-navy-900/60 text-xs">
                        {String(value ?? '')}
                    </span>
                </div>
            )}

            {field.type === 'text' && (
                <input
                    id={id}
                    type="text"
                    className={inputClass}
                    maxLength={200}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}

            {field.type === 'textarea' && (
                <textarea
                    id={id}
                    rows={6}
                    className={inputClass}
                    maxLength={1000}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}

            {field.help && (
                <p className="text-oxford-navy-900/55 text-xs">{field.help}</p>
            )}
        </div>
    );
}
