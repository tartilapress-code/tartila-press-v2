import { useCallback, useState } from 'react';
import * as api from '@/data/partnerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatRupiah } from '@/lib/format';

const input =
    'h-10 rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Laporan bagi hasil mitra: penjualan ebook (mitra 30%) dan bacaan langganan (mitra 15%). */
export default function PartnerReportPage() {
    const [from, setFrom] = useState<string>(daysAgo(29));
    const [to, setTo] = useState<string>(today());
    const { data, error, loading } = useLoad(
        useCallback(() => api.report(from, to), [from, to])
    );

    const rows = data?.data.rows ?? [];

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Bagi hasil mitra
                </h1>
                <p className="text-sm text-oxford-navy-900/65">
                    Pembelian ebook: Tartila 20% • mitra 30% • penulis 50%.
                    Langganan (menurut jumlah bacaan): Tartila 10% • mitra 15% •
                    penulis 75%. Hanya ebook yang sudah disetujui.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-oxford-navy-900">
                    Dari
                    <input
                        type="date"
                        value={from}
                        max={to}
                        onChange={(e) => setFrom(e.target.value)}
                        className={input}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-oxford-navy-900">
                    Sampai
                    <input
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                        className={input}
                    />
                </label>
                <p className="ml-auto rounded-xl bg-forest-moss-50 px-4 py-2 text-sm">
                    Bagian mitra:{' '}
                    <strong className="text-lg text-forest-moss-800">
                        {formatRupiah(data?.data.total ?? 0)}
                    </strong>
                </p>
            </div>

            {error && <p className="text-red-600">{error}</p>}

            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
                <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                        <tr className="bg-forest-moss-50 text-left text-oxford-navy-900">
                            <th className="p-2 font-semibold">Ebook</th>
                            <th className="p-2 font-semibold">Pembelian</th>
                            <th className="p-2 font-semibold">Bacaan</th>
                            <th className="p-2 text-right font-semibold">
                                Bagian mitra
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.reader_book_id}
                                className="border-t border-forest-moss-100 align-top"
                            >
                                <td className="p-2 font-medium">{row.title}</td>
                                <td className="p-2">
                                    {row.orders} pesanan
                                    <span className="block text-xs text-oxford-navy-900/60">
                                        {formatRupiah(row.revenue)}
                                    </span>
                                </td>
                                <td className="p-2">
                                    {row.read_events.toLocaleString('id-ID')}{' '}
                                    bacaan
                                </td>
                                <td className="p-2 text-right font-semibold">
                                    {formatRupiah(row.my_amount)}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="p-6 text-center text-oxford-navy-900/60"
                                >
                                    Belum ada ebook yang disetujui atau belum
                                    ada penjualan di rentang ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
