import type { CostSummary } from '@/lib/bookChapterCost';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function Row({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex flex-row justify-between gap-4 text-sm ${
                strong ? 'text-oxford-navy-900 font-semibold' : 'text-oxford-navy-900/70'
            }`}
        >
            <span>{label}</span>
            <span className="shrink-0">{value}</span>
        </div>
    );
}

/**
 * Perhitungan biaya 1 buku + (opsional) fee editor, diperbarui langsung saat
 * form diisi. Peringatan tampil bila sisa biaya di bawah minimal.
 */
export default function BookChapterCostPanel({
    summary,
    discount,
    showFee = false,
}: {
    summary: CostSummary;
    // Diskon bawaan proyek (%) — untuk penjelasan fee.
    discount: number;
    showFee?: boolean;
}) {
    const { deductions } = summary;

    return (
        <div className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
            <h6 className="text-oxford-navy-900 font-semibold">
                Perhitungan Biaya 1 Buku
            </h6>

            <div className="flex flex-col gap-1">
                <Row
                    label={`Total harga bab (${summary.chapter_count} bab)`}
                    value={rupiahFormatter.format(summary.chapters_total)}
                />
                {deductions.hki > 0 && (
                    <Row
                        label="− Biaya HKI"
                        value={rupiahFormatter.format(deductions.hki)}
                    />
                )}
                {deductions.isbn_print > 0 && (
                    <Row
                        label="− Biaya ISBN cetak"
                        value={rupiahFormatter.format(deductions.isbn_print)}
                    />
                )}
                {deductions.isbn_electronic > 0 && (
                    <Row
                        label="− Biaya e-ISBN"
                        value={rupiahFormatter.format(
                            deductions.isbn_electronic
                        )}
                    />
                )}
                {deductions.items > 0 && (
                    <Row
                        label="− Biaya fasilitas & layanan"
                        value={rupiahFormatter.format(deductions.items)}
                    />
                )}
                <Row
                    label="Sisa biaya"
                    value={rupiahFormatter.format(summary.net)}
                    strong
                />
                <Row
                    label="Minimal biaya 1 buku (ketentuan admin)"
                    value={rupiahFormatter.format(summary.min_book_cost)}
                />
            </div>

            {summary.chapter_count === 0 ? (
                <p className="text-oxford-navy-900/65 text-sm">
                    Belum ada bab. Tambahkan bab dan isi harganya — sisa biaya
                    harus mencapai minimal{' '}
                    {rupiahFormatter.format(summary.min_book_cost)} per buku.
                </p>
            ) : summary.meets_minimum ? (
                <p className="text-forest-moss-700 text-sm">
                    ✓ Biaya sudah mencukupi minimal 1 buku.
                </p>
            ) : (
                <p
                    role="alert"
                    className="text-red-700 text-sm bg-red-500/10 rounded-lg px-3 py-2"
                >
                    Biaya belum cukup — kurang{' '}
                    {rupiahFormatter.format(summary.shortfall)} dari minimal{' '}
                    {rupiahFormatter.format(summary.min_book_cost)} per buku.
                    Tambah bab atau naikkan harga bab.
                </p>
            )}

            <p className="text-oxford-navy-900/55 text-xs">
                Diskon tidak memengaruhi perhitungan ini — diskon hanya
                mengurangi fee editor.
            </p>

            {showFee && (
                <div className="flex flex-col gap-1 border-t border-forest-moss-200 pt-3">
                    <h6 className="text-oxford-navy-900 font-semibold">
                        Fee Editor Pemilik Proyek
                    </h6>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Diskon maksimal dari admin:{' '}
                        <strong>{summary.max_discount}%</strong>. Diskon yang
                        diberikan: <strong>{discount}%</strong>.
                    </p>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Fee = {summary.max_discount}% − {discount}% ={' '}
                        <strong className="text-forest-moss-700">
                            {summary.fee_percent}%
                        </strong>{' '}
                        dari harga tiap bab.
                    </p>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Jika seluruh {summary.chapter_count} bab terjual dan
                        buku terbit, potensi total fee:{' '}
                        <strong className="text-forest-moss-700 text-base">
                            {rupiahFormatter.format(summary.potential_fee)}
                        </strong>
                    </p>
                    {summary.fee_percent === 0 && (
                        <p className="text-oxford-navy-900/55 text-xs">
                            Diskon sudah menghabiskan seluruh fee. Turunkan
                            diskon supaya ada fee yang bisa Anda terima.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
