import Button from '@/components/Button/Button';
import type { VoucherState } from './useVoucher';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

// Kolom "Masukkan voucher" di halaman pembayaran.
export default function VoucherField({ voucher }: { voucher: VoucherState }) {
    const { quote } = voucher;

    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor="voucher-code"
                className="text-sm font-medium text-oxford-navy-900"
            >
                Voucher
            </label>

            {quote ? (
                <div className="flex flex-row items-center justify-between gap-3 rounded-xl bg-forest-moss-50 ring-1 ring-forest-moss-200 px-4 py-3">
                    <div className="flex flex-col">
                        <p className="text-forest-moss-800 text-sm font-semibold">
                            {quote.code} dipakai
                        </p>
                        <p className="text-forest-moss-700 text-sm">
                            Potongan{' '}
                            {rupiahFormatter.format(quote.voucher_discount)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={voucher.clear}
                        className="text-red-600 text-sm hover:text-red-700 hover:cursor-pointer"
                    >
                        Hapus
                    </button>
                </div>
            ) : (
                <div className="flex flex-row gap-2">
                    <input
                        id="voucher-code"
                        type="text"
                        value={voucher.input}
                        onChange={(e) => voucher.setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                voucher.apply();
                            }
                        }}
                        placeholder="Masukkan kode voucher"
                        autoComplete="off"
                        className="w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm uppercase text-oxford-navy-900 outline-none transition placeholder:normal-case placeholder:text-oxford-navy-900/40 hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30"
                    />
                    <Button
                        type="button"
                        variant="outline2"
                        className="shrink-0"
                        onClick={voucher.apply}
                        disabled={voucher.isChecking || !voucher.canApply}
                    >
                        {voucher.isChecking ? 'Memeriksa...' : 'Pakai'}
                    </Button>
                </div>
            )}

            {voucher.isStale && (
                <p className="text-sm text-amber-700">
                    Pilihan Anda berubah, voucher perlu diterapkan ulang.
                </p>
            )}
            {voucher.error && (
                <p className="text-red-600 text-sm">{voucher.error}</p>
            )}
        </div>
    );
}
