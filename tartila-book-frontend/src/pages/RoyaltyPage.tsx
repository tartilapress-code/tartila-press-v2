import { useCallback, useState } from 'react';
import Button from '@/components/Button';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatRupiah } from '@/lib/format';

function monthStart(): string {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

const today = (): string => new Date().toLocaleDateString('sv-SE');

/** Royalti baca milik penulis: pembelian buku + bacaan, bagian Anda per buku. */
export default function RoyaltyPage() {
    const [from, setFrom] = useState<string>(monthStart);
    const [to, setTo] = useState<string>(today);
    const [range, setRange] = useState<{ from: string; to: string }>({
        from: monthStart(),
        to: today(),
    });
    const { data, error, loading } = useLoad(
        useCallback(() => api.myRoyalty(range.from, range.to), [range])
    );
    const result = data?.data;
    const field =
        'h-10 rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm';

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10">
            <div>
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                    Royalti baca saya
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Untuk buku Anda di Tartila Book: persentase dari pembelian
                    satuan ditambah jumlah bacaan × biaya per bacaan. Bacaan
                    Anda sendiri tidak dihitung; bila penerimanya lebih dari
                    satu, dibagi menurut royalti ebook di MOU (tanpa MOU: rata).
                    Jumlah ini juga tampil di Royalti Saya dan Dompet Saya di
                    Tartila Press.
                </p>
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
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
                    Tampilkan
                </Button>
            </form>

            {error && <p className="text-red-600">{error}</p>}

            {result && (
                <>
                    <div className="rounded-2xl bg-forest-moss-50 p-5 ring-1 ring-forest-moss-200">
                        <p className="text-sm text-oxford-navy-900/70">
                            Total royalti Anda pada periode ini
                        </p>
                        <p
                            className={`font-display text-3xl font-bold text-forest-moss-800 ${loading ? 'opacity-60' : ''}`}
                        >
                            {formatRupiah(result.my_total)}
                        </p>
                    </div>

                    {result.rows.length === 0 ? (
                        <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                            Anda belum punya buku di Tartila Book.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl ring-1 ring-forest-moss-100">
                            <table className="w-full min-w-[40rem] text-sm">
                                <thead className="bg-forest-moss-50 text-left text-oxford-navy-900">
                                    <tr>
                                        <th className="p-3 font-semibold">
                                            Buku
                                        </th>
                                        <th className="p-3 text-right font-semibold">
                                            Pembelian
                                        </th>
                                        <th className="p-3 text-right font-semibold">
                                            Bacaan
                                        </th>
                                        <th className="p-3 text-right font-semibold">
                                            Total buku
                                        </th>
                                        <th className="p-3 text-right font-semibold">
                                            Bagian Anda
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row) => (
                                        <tr
                                            key={row.reader_book_id}
                                            className="border-t border-forest-moss-100"
                                        >
                                            <td className="p-3">
                                                <span className="font-semibold text-oxford-navy-700">
                                                    {row.title}
                                                </span>
                                                {row.authors_count > 1 && (
                                                    <span className="block text-xs text-oxford-navy-900/60">
                                                        dibagi{' '}
                                                        {row.authors_count}{' '}
                                                        penulis
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {row.orders}× ·{' '}
                                                {formatRupiah(
                                                    row.purchase_royalty
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {row.read_events.toLocaleString(
                                                    'id-ID'
                                                )}{' '}
                                                ·{' '}
                                                {formatRupiah(row.read_royalty)}
                                            </td>
                                            <td className="p-3 text-right">
                                                {formatRupiah(row.total)}
                                            </td>
                                            <td className="p-3 text-right font-semibold text-forest-moss-800">
                                                {formatRupiah(row.my_amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
