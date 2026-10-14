import type { DistributionMode, DistributionOption } from '@/data/mou/mouApi';

export type MouContentDraft = {
    title: string;
    opening: string;
    distribution_options: DistributionOption[];
    distribution_mode: DistributionMode;
    first_party_terms: string[];
    second_party_terms: string[];
    closing_terms: string[];
    contact_note: string | null;
};

const fieldClass =
    'w-full rounded-lg border border-oxford-navy-900/15 bg-white p-2 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const labelClass = 'text-sm font-semibold text-oxford-navy-900';

function TermsEditor({
    label,
    hint,
    items,
    onChange,
}: {
    label: string;
    hint?: string;
    items: string[];
    onChange: (items: string[]) => void;
}) {
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>{label}</legend>
            {hint && (
                <p className="-mt-1 text-xs text-oxford-navy-900/60">{hint}</p>
            )}
            {items.map((item, index) => (
                <div key={index} className="flex flex-row items-start gap-2">
                    <span className="pt-2 text-sm text-oxford-navy-900/60">
                        {index + 1}.
                    </span>
                    <textarea
                        rows={2}
                        className={fieldClass}
                        aria-label={`${label} poin ${index + 1}`}
                        value={item}
                        maxLength={1500}
                        onChange={(e) =>
                            onChange(
                                items.map((value, i) =>
                                    i === index ? e.target.value : value
                                )
                            )
                        }
                    />
                    <button
                        type="button"
                        className="pt-2 text-xs text-red-600 hover:underline hover:cursor-pointer disabled:opacity-40"
                        disabled={items.length <= 1}
                        onClick={() =>
                            onChange(items.filter((_, i) => i !== index))
                        }
                    >
                        Hapus
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="self-start text-sm font-semibold text-forest-moss-700 hover:underline hover:cursor-pointer"
                onClick={() => onChange([...items, ''])}
            >
                + Tambah poin
            </button>
        </fieldset>
    );
}

/**
 * Kolom isi MOU (judul, pembukaan, hak distribusi, hak & tanggung jawab
 * kedua pihak, ketentuan adendum) — dipakai template utama dan penyesuaian
 * MOU per judul.
 */
export default function MouContentFields({
    value,
    onChange,
}: {
    value: MouContentDraft;
    onChange: (next: MouContentDraft) => void;
}) {
    const set = <K extends keyof MouContentDraft>(
        key: K,
        next: MouContentDraft[K]
    ) => onChange({ ...value, [key]: next });

    const setOption = (index: number, patch: Partial<DistributionOption>) =>
        set(
            'distribution_options',
            value.distribution_options.map((option, i) =>
                i === index ? { ...option, ...patch } : option
            )
        );

    return (
        <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-1">
                <span className={labelClass}>Judul MOU</span>
                <input
                    className={fieldClass}
                    value={value.title}
                    maxLength={255}
                    onChange={(e) => set('title', e.target.value)}
                />
            </label>

            <label className="flex flex-col gap-1">
                <span className={labelClass}>Pembukaan</span>
                <span className="text-xs text-oxford-navy-900/60">
                    Penanda: {'{judul}'} = judul buku, {'{penerbit}'} = nama
                    penerbit.
                </span>
                <textarea
                    rows={3}
                    className={fieldClass}
                    value={value.opening}
                    maxLength={5000}
                    onChange={(e) => set('opening', e.target.value)}
                />
            </label>

            <fieldset className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3">
                <legend className={labelClass}>
                    Pilihan hak distribusi buku
                </legend>
                <div className="flex flex-col gap-1 text-sm text-oxford-navy-900">
                    <label className="flex flex-row items-center gap-2">
                        <input
                            type="radio"
                            name="distribution-mode"
                            checked={value.distribution_mode === 'one'}
                            onChange={() => set('distribution_mode', 'one')}
                        />
                        Penulis memilih <strong>salah satu</strong>
                    </label>
                    <label className="flex flex-row items-center gap-2">
                        <input
                            type="radio"
                            name="distribution-mode"
                            checked={value.distribution_mode === 'all'}
                            onChange={() => set('distribution_mode', 'all')}
                        />
                        <span>
                            <strong>Wajib semua</strong> hak distribusi di bawah
                        </span>
                    </label>
                </div>
                {value.distribution_options.map((option, index) => (
                    <div
                        key={index}
                        className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-forest-moss-100"
                    >
                        <div className="flex flex-row items-center gap-2">
                            <input
                                className={fieldClass}
                                placeholder="Nama hak distribusi"
                                aria-label={`Nama hak distribusi ${index + 1}`}
                                value={option.name}
                                maxLength={150}
                                onChange={(e) =>
                                    setOption(index, { name: e.target.value })
                                }
                            />
                            <button
                                type="button"
                                className="text-xs text-red-600 hover:underline hover:cursor-pointer disabled:opacity-40"
                                disabled={
                                    value.distribution_options.length <= 1
                                }
                                onClick={() =>
                                    set(
                                        'distribution_options',
                                        value.distribution_options.filter(
                                            (_, i) => i !== index
                                        )
                                    )
                                }
                            >
                                Hapus
                            </button>
                        </div>
                        <textarea
                            rows={4}
                            className={fieldClass}
                            placeholder={
                                'Rincian hak, satu poin per baris. Contoh:\nDistribusi hanya dilakukan oleh Pihak Pertama.\nPihak Kedua dilarang mendistribusikan ke pihak lain.'
                            }
                            aria-label={`Rincian hak distribusi ${index + 1} (satu poin per baris)`}
                            value={(option.points ?? []).join('\n')}
                            onChange={(e) =>
                                setOption(index, {
                                    points: e.target.value.split('\n'),
                                })
                            }
                        />
                        <input
                            className={fieldClass}
                            placeholder="Ringkasan singkat (opsional)"
                            aria-label={`Ringkasan hak distribusi ${index + 1}`}
                            value={option.description}
                            maxLength={500}
                            onChange={(e) =>
                                setOption(index, {
                                    description: e.target.value,
                                })
                            }
                        />
                    </div>
                ))}
                <button
                    type="button"
                    className="self-start text-sm font-semibold text-forest-moss-700 hover:underline hover:cursor-pointer"
                    onClick={() =>
                        set('distribution_options', [
                            ...value.distribution_options,
                            { key: '', name: '', description: '', points: [] },
                        ])
                    }
                >
                    + Tambah hak distribusi
                </button>
            </fieldset>

            <TermsEditor
                label="Hak dan tanggung jawab Pihak Pertama (penerbit)"
                items={value.first_party_terms}
                onChange={(items) => set('first_party_terms', items)}
            />
            <TermsEditor
                label="Hak dan tanggung jawab Pihak Kedua (penulis)"
                items={value.second_party_terms}
                onChange={(items) => set('second_party_terms', items)}
            />
            <TermsEditor
                label="Perubahan, adendum dan penyelesaian"
                hint="Mis. aturan baru berlaku maju, adendum lewat email resmi dan harus disetujui kedua pihak, pelanggaran ditindak sesuai hukum."
                items={value.closing_terms}
                onChange={(items) => set('closing_terms', items)}
            />

            <label className="flex flex-col gap-1">
                <span className={labelClass}>
                    Catatan untuk penulis (arahkan ke WhatsApp/email admin)
                </span>
                <textarea
                    rows={2}
                    className={fieldClass}
                    value={value.contact_note ?? ''}
                    maxLength={1000}
                    onChange={(e) =>
                        set('contact_note', e.target.value || null)
                    }
                />
            </label>
        </div>
    );
}
