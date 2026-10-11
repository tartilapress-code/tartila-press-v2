import { useState } from 'react';
import Button from '@/components/Button/Button';
import * as financeApi from '@/data/finance/financeApi';
import { describeApiError } from '@/lib/apiErrors';
import { rupiah } from './format';

type Field =
    | 'book_price'
    | 'extra_copies'
    | 'includes_hki'
    | 'admin_cover_cost'
    | 'speaker_fee'
    | 'other_costs'
    | 'note';

const LABELS: Record<Field, string> = {
    book_price: 'Harga jual buku (Rp)',
    extra_copies: 'Eksemplar tambahan dari fasilitas (N)',
    includes_hki: 'HAKI',
    admin_cover_cost: 'Administrasi & cover (Rp)',
    speaker_fee: 'Fee pemateri (Rp)',
    other_costs: 'Biaya lainnya (Rp)',
    note: 'Catatan',
};

function toText(value: number | string | null | undefined): string {
    return value === null || value === undefined ? '' : String(value);
}

/**
 * Formulir isian admin untuk satu baris rincian. Kolom dikosongkan =
 * kembali ke nilai otomatis (ditampilkan sebagai placeholder).
 */
export default function DetailEditor({
    subjectType,
    subjectId,
    fields,
    overrides,
    automatic,
    onSaved,
    onCancel,
}: {
    subjectType: financeApi.DetailPayload['subject_type'];
    subjectId: number;
    fields: Field[];
    overrides: financeApi.Overrides;
    // Nilai otomatis untuk placeholder, mis. { book_price: 50000 }.
    automatic: Partial<Record<Field, number | boolean>>;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [values, setValues] = useState<Record<Field, string>>({
        book_price: toText(overrides.book_price),
        extra_copies: toText(overrides.extra_copies),
        includes_hki:
            overrides.includes_hki === null
                ? ''
                : overrides.includes_hki
                  ? 'yes'
                  : 'no',
        admin_cover_cost: toText(overrides.admin_cover_cost),
        speaker_fee: toText(overrides.speaker_fee),
        other_costs: toText(overrides.other_costs),
        note: overrides.note ?? '',
    });
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    function number(value: string): number | null {
        return value.trim() === '' ? null : Number(value);
    }

    async function save() {
        setIsSaving(true);
        setError('');

        try {
            await financeApi.saveDetail({
                subject_type: subjectType,
                subject_id: subjectId,
                book_price: number(values.book_price),
                extra_copies: number(values.extra_copies),
                includes_hki:
                    values.includes_hki === ''
                        ? null
                        : values.includes_hki === 'yes',
                admin_cover_cost: number(values.admin_cover_cost),
                speaker_fee: number(values.speaker_fee),
                other_costs: number(values.other_costs),
                note: values.note.trim() === '' ? null : values.note.trim(),
            });
            onSaved();
        } catch (caught) {
            setError(describeApiError(caught));
            setIsSaving(false);
        }
    }

    function placeholder(field: Field): string {
        const value = automatic[field];

        if (value === undefined || typeof value === 'boolean') return '';

        return field === 'extra_copies'
            ? `Otomatis: ${value}`
            : `Otomatis: ${rupiah(value)}`;
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-forest-moss-200">
            <p className="text-xs text-oxford-navy-900/65">
                Kosongkan kolom untuk memakai nilai otomatis.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) =>
                    field === 'includes_hki' ? (
                        <label
                            key={field}
                            className="flex flex-col gap-1 text-xs text-oxford-navy-900/70"
                        >
                            {LABELS[field]}
                            <select
                                value={values.includes_hki}
                                onChange={(e) =>
                                    setValues({
                                        ...values,
                                        includes_hki: e.target.value,
                                    })
                                }
                                className="rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900"
                            >
                                <option value="">
                                    Otomatis (
                                    {automatic.includes_hki
                                        ? 'termasuk'
                                        : 'tidak'}
                                    )
                                </option>
                                <option value="yes">Termasuk HAKI</option>
                                <option value="no">Tanpa HAKI</option>
                            </select>
                        </label>
                    ) : (
                        <label
                            key={field}
                            className={`flex flex-col gap-1 text-xs text-oxford-navy-900/70 ${field === 'note' ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                        >
                            {LABELS[field]}
                            <input
                                type={field === 'note' ? 'text' : 'number'}
                                min={field === 'note' ? undefined : 0}
                                value={values[field]}
                                placeholder={placeholder(field)}
                                onChange={(e) =>
                                    setValues({
                                        ...values,
                                        [field]: e.target.value,
                                    })
                                }
                                className="rounded-md border border-oxford-navy-900/15 bg-white px-2 py-1.5 text-sm text-oxford-navy-900 placeholder:text-oxford-navy-900/45"
                            />
                        </label>
                    )
                )}
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-row gap-2">
                <Button variant="primary" disabled={isSaving} onClick={save}>
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button variant="outline2" onClick={onCancel}>
                    Batal
                </Button>
            </div>
        </div>
    );
}
