import { useCallback, useState, type FormEvent } from 'react';
import Button from '@/components/Button';
import Pagination from '@/components/Pagination';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { describeApiError } from '@/lib/apiErrors';
import { formatRupiah } from '@/lib/format';

const field =
    'h-10 rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm';

const monthStart = (): string => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = (): string => new Date().toLocaleDateString('sv-SE');

function SettingsForm({ onSaved }: { onSaved: () => void }) {
    const { data, reload } = useLoad(
        useCallback(() => api.adminSettings(), [])
    );
    const [draft, setDraft] = useState<{ percent: string; fee: string } | null>(
        null
    );
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const values = draft ?? {
        percent: String(data?.data.purchase_royalty_percent ?? ''),
        fee: String(data?.data.read_fee ?? ''),
    };

    async function save(event: FormEvent) {
        event.preventDefault();
        setMessage('');
        setIsError(false);

        try {
            const response = await api.adminSaveSettings({
                purchase_royalty_percent: Number(values.percent),
                read_fee: Number(values.fee),
            });
            setMessage(response.message);
            setDraft(null);
            reload();
            onSaved();
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        }
    }

    if (!data) return null;

    return (
        <form
            onSubmit={save}
            className="grid gap-4 rounded-xl bg-forest-moss-50/70 p-4 sm:grid-cols-2"
        >
            <div className="sm:col-span-2">
                <h2 className="font-semibold text-oxford-navy-900">
                    Aturan royalti (umum)
                </h2>
                <p className="text-xs text-oxford-navy-900/65">
                    Dua sistem: <strong>pembelian</strong> = persentase dari
                    harga pembelian buku satuan; <strong>bacaan</strong> =
                    jumlah bacaan × biaya per bacaan. Satu bacaan = satu pembaca
                    membuka satu halaman pada satu hari (hari yang sama dihitung
                    1). Bacaan penulis sendiri tidak dihitung. Dapat diganti per
                    buku di menu Buku & ebook.
                </p>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                Persen dari pembelian (%)
                <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className={field}
                    value={values.percent}
                    onChange={(e) =>
                        setDraft({ ...values, percent: e.target.value })
                    }
                />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                Biaya per bacaan (Rp)
                <input
                    type="number"
                    min={0}
                    step="1"
                    className={field}
                    value={values.fee}
                    onChange={(e) =>
                        setDraft({ ...values, fee: e.target.value })
                    }
                />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit">Simpan aturan</Button>
                {message && (
                    <span
                        role="status"
                        className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                    >
                        {message}
                    </span>
                )}
            </div>
        </form>
    );
}

/** Admin: aturan royalti dan laporan royalti per buku & penulis pada rentang tanggal. */
export default function AdminRoyaltiesPage() {
    const [from, setFrom] = useState<string>(monthStart);
    const [to, setTo] = useState<string>(today);
    const [range, setRange] = useState<{ from: string; to: string }>({
        from: monthStart(),
        to: today(),
    });
    const [page, setPage] = useState<number>(1);
    const { data, error, loading } = useLoad(
        useCallback(() => api.adminRoyalties({ ...range, page }), [range, page])
    );
    const totals = data?.meta.totals;

    return (
        <div className="flex flex-col gap-6">
            <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                Royalti & pengaturan
            </h1>
            <SettingsForm
                onSaved={() => setRange((current) => ({ ...current }))}
            />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setRange({ from, to });
                }}
                className="flex flex-wrap items-end gap-3"
            >
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Dari
                    <input
                        type="date"
                        className={field}
                        value={from}
                        max={to}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
                    Sampai
                    <input
                        type="date"
                        className={field}
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </label>
                <Button type="submit" className="h-10 py-0">
                    Hitung royalti
                </Button>
            </form>

            {error && <p className="text-red-600">{error}</p>}

            {totals && (
                <div
                    className={`grid gap-3 sm:grid-cols-4 ${loading ? 'opacity-60' : ''}`}
                >
                    {[
                        ['Penjualan buku', formatRupiah(totals.revenue)],
                        [
                            'Royalti pembelian',
                            formatRupiah(totals.purchase_royalty),
                        ],
                        [
                            `Royalti bacaan (${totals.read_events.toLocaleString('id-ID')} bacaan)`,
                            formatRupiah(totals.read_royalty),
                        ],
                        ['Total royalti', formatRupiah(totals.total)],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100"
                        >
                            <p className="text-xs text-oxford-navy-900/65">
                                {label}
                            </p>
                            <p className="font-display text-lg font-bold text-oxford-navy-700">
                                {value}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl ring-1 ring-forest-moss-100">
                <table className="w-full min-w-[56rem] text-sm">
                    <thead className="bg-forest-moss-50 text-left text-oxford-navy-900">
                        <tr>
                            <th className="p-3 font-semibold">Buku</th>
                            <th className="p-3 text-right font-semibold">
                                Pembelian
                            </th>
                            <th className="p-3 text-right font-semibold">
                                Bacaan
                            </th>
                            <th className="p-3 text-right font-semibold">
                                Total
                            </th>
                            <th className="p-3 font-semibold">Per penulis</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.data.map((row) => (
                            <tr
                                key={row.reader_book_id}
                                className="border-t border-forest-moss-100 align-top"
                            >
                                <td className="p-3 font-semibold text-oxford-navy-700">
                                    {row.title}
                                </td>
                                <td className="p-3 text-right">
                                    {row.orders}× {formatRupiah(row.revenue)}
                                    <span className="block text-xs text-oxford-navy-900/60">
                                        {row.purchase_percent}% ={' '}
                                        {formatRupiah(row.purchase_royalty)}
                                    </span>
                                </td>
                                <td className="p-3 text-right">
                                    {row.read_events.toLocaleString('id-ID')}{' '}
                                    bacaan ({row.readers} pembaca)
                                    <span className="block text-xs text-oxford-navy-900/60">
                                        × {formatRupiah(row.read_fee)} ={' '}
                                        {formatRupiah(row.read_royalty)}
                                    </span>
                                </td>
                                <td className="p-3 text-right font-semibold">
                                    {formatRupiah(row.total)}
                                </td>
                                <td className="p-3">
                                    {row.authors.length === 0 ? (
                                        <span className="text-oxford-navy-900/55">
                                            Tanpa penulis terdaftar
                                        </span>
                                    ) : (
                                        row.authors.map((author) => (
                                            <span
                                                key={author.user_id}
                                                className="block text-xs"
                                            >
                                                {author.name}:{' '}
                                                <strong>
                                                    {formatRupiah(
                                                        author.amount
                                                    )}
                                                </strong>
                                            </span>
                                        ))
                                    )}
                                </td>
                            </tr>
                        ))}
                        {data && data.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="p-8 text-center text-oxford-navy-900/60"
                                >
                                    Belum ada buku.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination meta={data?.meta ?? null} onPageChange={setPage} />
        </div>
    );
}
