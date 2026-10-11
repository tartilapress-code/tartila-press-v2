import { useCallback, useState, type FormEvent } from 'react';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatRupiah } from '@/lib/format';

const field =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm';

type Draft = {
    id: number | null;
    name: string;
    period: api.Plan['period'];
    price: string;
    description: string;
    is_active: boolean;
};
const EMPTY: Draft = {
    id: null,
    name: '',
    period: 'monthly',
    price: '',
    description: '',
    is_active: true,
};

/** Admin: paket langganan (harian, mingguan, bulanan, tahunan) dan harganya. */
export default function AdminPlansPage() {
    const { data, error, reload } = useLoad(
        useCallback(() => api.adminPlans(), [])
    );
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);

    async function save(event: FormEvent) {
        event.preventDefault();
        setMessage('');
        setIsError(false);

        try {
            await api.adminSavePlan(
                {
                    name: draft.name.trim(),
                    period: draft.period,
                    price: Number(draft.price),
                    description: draft.description.trim() || null,
                    is_active: draft.is_active,
                },
                draft.id ?? undefined
            );
            setDraft(EMPTY);
            setMessage('Paket disimpan.');
            reload();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Paket langganan
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Selama langganan aktif, semua buku bisa dibaca. Tanpa
                    langganan, buku terkunci (kecuali dibuka gratis atau dibeli
                    satuan).
                </p>
            </div>
            {error && <p className="text-red-600">{error}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
                {data?.data.map((plan) => (
                    <article
                        key={plan.id}
                        className={`flex flex-col gap-1 rounded-xl p-4 ring-1 ${plan.is_active ? 'bg-forest-moss-50/60 ring-forest-moss-100' : 'bg-oxford-navy-900/[0.03] ring-oxford-navy-900/10'}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-oxford-navy-700">
                                {plan.name}
                            </p>
                            <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${plan.is_active ? 'bg-forest-moss-100 text-forest-moss-800' : 'bg-oxford-navy-900/10 text-oxford-navy-900/70'}`}
                            >
                                {plan.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                        </div>
                        <p className="text-sm text-oxford-navy-900/80">
                            {plan.period_label} • {formatRupiah(plan.price)}
                        </p>
                        {plan.description && (
                            <p className="text-xs text-oxford-navy-900/60">
                                {plan.description}
                            </p>
                        )}
                        <button
                            type="button"
                            className="self-start text-sm font-semibold text-forest-moss-700 hover:cursor-pointer hover:underline"
                            onClick={() =>
                                setDraft({
                                    id: plan.id,
                                    name: plan.name,
                                    period: plan.period,
                                    price: String(plan.price),
                                    description: plan.description ?? '',
                                    is_active: plan.is_active,
                                })
                            }
                        >
                            Ubah
                        </button>
                    </article>
                ))}
                {data && data.data.length === 0 && (
                    <p className="text-sm text-oxford-navy-900/60">
                        Belum ada paket.
                    </p>
                )}
            </div>

            <form
                onSubmit={save}
                className="flex flex-col gap-4 rounded-xl bg-forest-moss-50/70 p-4"
            >
                <h2 className="font-semibold text-oxford-navy-900">
                    {draft.id ? 'Ubah paket' : 'Tambah paket'}
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Nama
                        <input
                            className={field}
                            required
                            value={draft.name}
                            onChange={(e) =>
                                setDraft({ ...draft, name: e.target.value })
                            }
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Jenis
                        <select
                            className={field}
                            value={draft.period}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    period: e.target
                                        .value as api.Plan['period'],
                                })
                            }
                        >
                            {Object.entries(api.PERIOD_LABEL).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                        Biaya (Rp)
                        <input
                            type="number"
                            min={1}
                            required
                            className={field}
                            value={draft.price}
                            onChange={(e) =>
                                setDraft({ ...draft, price: e.target.value })
                            }
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Keterangan (opsional)
                    <input
                        className={field}
                        maxLength={500}
                        value={draft.description}
                        onChange={(e) =>
                            setDraft({ ...draft, description: e.target.value })
                        }
                    />
                </label>
                <label className="flex items-center gap-2 text-sm text-oxford-navy-900">
                    <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(e) =>
                            setDraft({ ...draft, is_active: e.target.checked })
                        }
                    />
                    Dijual (aktif)
                </label>
                {message && (
                    <p
                        role="status"
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </p>
                )}
                <div className="flex gap-3">
                    <Button type="submit">
                        {draft.id ? 'Simpan perubahan' : 'Tambah paket'}
                    </Button>
                    {draft.id && (
                        <Button
                            type="button"
                            variant="outline2"
                            onClick={() => setDraft(EMPTY)}
                        >
                            Batal
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
