import type { ReactNode } from 'react';
import {
    RiAlignBottom,
    RiAlignCenter,
    RiAlignLeft,
    RiAlignRight,
    RiAlignTop,
    RiAlignVertically,
    RiDeleteBinLine,
    RiFileCopyLine,
} from '@remixicon/react';
import type {
    CertificateFont,
    CertificateTemplateType,
    CertificateVariable,
    TemplateField,
} from '@/data/certificate/certificateApi';

type FieldInspectorProps = {
    field: TemplateField;
    fonts: CertificateFont[];
    variables: CertificateVariable[];
    type: CertificateTemplateType;
    onChange: (patch: Partial<TemplateField>) => void;
    onDuplicate: () => void;
    onDelete: () => void;
};

const inputClass =
    'w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 py-2 text-sm text-oxford-navy-900 outline-none transition hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

const categoryLabels: Record<CertificateFont['category'], string> = {
    serif: 'Serif',
    script: 'Tulisan tangan',
    sans: 'Sans-serif',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-oxford-navy-900 text-xs font-medium">
                {label}
            </span>
            {children}
        </label>
    );
}

function ToggleGroup<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string; icon: ReactNode }[];
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex flex-row gap-1">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 transition ${
                        value === option.value
                            ? 'border-forest-moss-600 bg-forest-moss-100 text-forest-moss-800'
                            : 'border-oxford-navy-900/15 text-oxford-navy-700 hover:bg-forest-moss-50'
                    }`}
                >
                    {option.icon}
                </button>
            ))}
        </div>
    );
}

/** Percentage input for one edge of the field box. */
function PercentInput({
    label,
    value,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}) {
    return (
        <Row label={label}>
            <input
                type="number"
                step="0.1"
                min={min}
                max={max}
                value={Math.round(value * 1000) / 10}
                onChange={(event) => {
                    const next = Number(event.target.value) / 100;

                    if (!Number.isNaN(next)) {
                        onChange(
                            Math.min(max / 100, Math.max(min / 100, next))
                        );
                    }
                }}
                className={inputClass}
            />
        </Row>
    );
}

export default function FieldInspector({
    field,
    fonts,
    variables,
    type,
    onChange,
    onDuplicate,
    onDelete,
}: FieldInspectorProps) {
    const font = fonts.find((candidate) => candidate.key === field.font);
    const hasBold = font?.bold_file != null;
    const dynamicVariable = variables.find((variable) => variable.dynamic);

    return (
        <div className="flex flex-col gap-4">
            <Row label="Isi teks">
                <textarea
                    rows={3}
                    value={field.text}
                    onChange={(event) => onChange({ text: event.target.value })}
                    className={`${inputClass} resize-y`}
                    placeholder="Ketik teks, atau sisipkan data di bawah"
                />
            </Row>

            <Row label="Sisipkan data otomatis">
                <select
                    value=""
                    onChange={(event) => {
                        if (event.target.value) {
                            // A space before the token unless the text is empty
                            // or already ends with whitespace/newline.
                            const separator =
                                field.text === '' || /\s$/.test(field.text)
                                    ? ''
                                    : ' ';

                            onChange({
                                text: `${field.text}${separator}{${event.target.value}}`,
                            });
                        }
                    }}
                    className={inputClass}
                >
                    <option value="">Pilih data untuk disisipkan…</option>
                    {variables.map((variable) => (
                        <option key={variable.token} value={variable.token}>
                            {variable.label}
                            {variable.dynamic ? '' : ` — {${variable.token}}`}
                        </option>
                    ))}
                </select>
                {dynamicVariable && type === 'event' && (
                    <span className="text-oxford-navy-900/60 text-xs">
                        Untuk jawaban absensi, lengkapi dengan kunci kolomnya
                        (tampil di halaman Absensi event), mis.{' '}
                        <code>{'{answer_institusi}'}</code>.
                    </span>
                )}
            </Row>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <Row label="Font">
                        <select
                            value={field.font}
                            onChange={(event) => {
                                const next = fonts.find(
                                    (candidate) =>
                                        candidate.key === event.target.value
                                );

                                onChange({
                                    font: event.target.value,
                                    bold: next?.bold_file ? field.bold : false,
                                });
                            }}
                            className={inputClass}
                        >
                            {(['serif', 'script', 'sans'] as const).map(
                                (category) => (
                                    <optgroup
                                        key={category}
                                        label={categoryLabels[category]}
                                    >
                                        {fonts
                                            .filter(
                                                (candidate) =>
                                                    candidate.category ===
                                                    category
                                            )
                                            .map((candidate) => (
                                                <option
                                                    key={candidate.key}
                                                    value={candidate.key}
                                                >
                                                    {candidate.label}
                                                </option>
                                            ))}
                                    </optgroup>
                                )
                            )}
                        </select>
                    </Row>
                </div>

                <Row label="Ukuran (pt)">
                    <input
                        type="number"
                        min={6}
                        max={200}
                        step={1}
                        value={field.size}
                        onChange={(event) => {
                            const next = Number(event.target.value);

                            if (!Number.isNaN(next)) {
                                onChange({
                                    size: Math.min(200, Math.max(6, next)),
                                });
                            }
                        }}
                        className={inputClass}
                    />
                </Row>

                <Row label="Warna">
                    <div className="flex flex-row items-center gap-2">
                        <input
                            type="color"
                            value={field.color}
                            onChange={(event) =>
                                onChange({ color: event.target.value })
                            }
                            className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-oxford-navy-900/15 bg-white p-1"
                            aria-label="Warna teks"
                        />
                        <span className="text-oxford-navy-900/70 font-mono text-xs">
                            {field.color}
                        </span>
                    </div>
                </Row>
            </div>

            <input
                type="range"
                min={6}
                max={120}
                step={1}
                value={Math.min(120, field.size)}
                onChange={(event) =>
                    onChange({ size: Number(event.target.value) })
                }
                aria-label="Ukuran huruf"
                className="accent-forest-moss-600 w-full"
            />

            <div className="grid grid-cols-2 gap-3">
                <Row label="Rata teks">
                    <ToggleGroup
                        value={field.align}
                        onChange={(align) => onChange({ align })}
                        options={[
                            {
                                value: 'left',
                                label: 'Rata kiri',
                                icon: <RiAlignLeft className="size-4" />,
                            },
                            {
                                value: 'center',
                                label: 'Tengah',
                                icon: <RiAlignCenter className="size-4" />,
                            },
                            {
                                value: 'right',
                                label: 'Rata kanan',
                                icon: <RiAlignRight className="size-4" />,
                            },
                        ]}
                    />
                </Row>
                <Row label="Posisi vertikal">
                    <ToggleGroup
                        value={field.valign}
                        onChange={(valign) => onChange({ valign })}
                        options={[
                            {
                                value: 'top',
                                label: 'Atas',
                                icon: <RiAlignTop className="size-4" />,
                            },
                            {
                                value: 'middle',
                                label: 'Tengah',
                                icon: <RiAlignVertically className="size-4" />,
                            },
                            {
                                value: 'bottom',
                                label: 'Bawah',
                                icon: <RiAlignBottom className="size-4" />,
                            },
                        ]}
                    />
                </Row>
            </div>

            <div className="flex flex-col gap-2">
                <label
                    className={`text-oxford-navy-900 flex flex-row items-center gap-2 text-sm ${
                        hasBold ? '' : 'opacity-50'
                    }`}
                >
                    <input
                        type="checkbox"
                        checked={hasBold && field.bold}
                        disabled={!hasBold}
                        onChange={(event) =>
                            onChange({ bold: event.target.checked })
                        }
                    />
                    Huruf tebal{!hasBold && ' (tidak tersedia di font ini)'}
                </label>
                <label className="text-oxford-navy-900 flex flex-row items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={field.uppercase}
                        onChange={(event) =>
                            onChange({ uppercase: event.target.checked })
                        }
                    />
                    HURUF BESAR semua
                </label>
                <label className="text-oxford-navy-900 flex flex-row items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={field.autoFit}
                        onChange={(event) =>
                            onChange({ autoFit: event.target.checked })
                        }
                    />
                    Kecilkan huruf otomatis agar muat di kotak
                </label>
            </div>

            <fieldset className="flex flex-col gap-2">
                <legend className="text-oxford-navy-900 mb-1 text-xs font-medium">
                    Kotak teks (% dari halaman)
                </legend>
                <div className="grid grid-cols-2 gap-3">
                    <PercentInput
                        label="Kiri"
                        value={field.x}
                        min={0}
                        max={100 - field.w * 100}
                        onChange={(x) => onChange({ x })}
                    />
                    <PercentInput
                        label="Atas"
                        value={field.y}
                        min={0}
                        max={100 - field.h * 100}
                        onChange={(y) => onChange({ y })}
                    />
                    <PercentInput
                        label="Lebar"
                        value={field.w}
                        min={2}
                        max={100 - field.x * 100}
                        onChange={(w) => onChange({ w })}
                    />
                    <PercentInput
                        label="Tinggi"
                        value={field.h}
                        min={1}
                        max={100 - field.y * 100}
                        onChange={(h) => onChange({ h })}
                    />
                </div>
            </fieldset>

            <div className="flex flex-row gap-2">
                <button
                    type="button"
                    onClick={onDuplicate}
                    className="text-oxford-navy-700 hover:bg-forest-moss-50 inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-oxford-navy-200 px-3 py-2 text-sm font-semibold"
                >
                    <RiFileCopyLine aria-hidden className="size-4" />
                    Gandakan
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                    <RiDeleteBinLine aria-hidden className="size-4" />
                    Hapus
                </button>
            </div>
        </div>
    );
}
