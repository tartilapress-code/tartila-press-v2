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
                strong
                    ? 'text-oxford-navy-900 font-semibold'
                    : 'text-oxford-navy-900/70'
            }`}
        >
            <span>{label}</span>
            <span className="shrink-0">{value}</span>
        </div>
    );
}

/**
 * Perhitungan biaya 1 buku + (opsional) fee editor, diperbarui langsung saat
 * form diisi. Peringatan tampil bila sisa biaya tidak melebihi biaya wajib.
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
                {deductions.max_fee > 0 && (
                    <Row
                        label={`− Fee maksimal editor (${summary.max_discount}% × total bab)`}
                        value={rupiahFormatter.format(deductions.max_fee)}
                    />
                )}
                <Row
                    label="Sisa biaya"
                    value={rupiahFormatter.format(summary.net)}
                    strong
                />
                <Row
                    label="Biaya wajib"
                    value={rupiahFormatter.format(summary.min_book_cost)}
                />
            </div>

            <p className="text-oxford-navy-900/65 text-xs">
                Sisa biaya harus sama dengan atau lebih dari biaya wajib. Total
                biaya proyek ini (biaya wajib + HKI + ISBN + fasilitas &amp;
                layanan
                {deductions.max_fee > 0 ? ' + fee maksimal editor' : ''}) ={' '}
                <strong>
                    {rupiahFormatter.format(summary.required_total)}
                </strong>
                ; total harga bab tidak boleh kurang dari itu.
            </p>

            {summary.chapter_count === 0 ? (
                <p className="text-oxford-navy-900/65 text-sm">
                    Belum ada bab. Tambahkan bab dan isi harganya — sisa biaya
                    harus sama dengan atau lebih dari biaya wajib{' '}
                    {rupiahFormatter.format(summary.min_book_cost)} per buku.
                    Perkiraan awal total biaya proyek (sebelum bab lengkap):{' '}
                    <strong>
                        {rupiahFormatter.format(summary.estimated_required)}
                    </strong>
                    ; angkanya berubah mengikuti total harga bab dan fee editor.
                </p>
            ) : summary.meets_minimum ? (
                <p className="text-forest-moss-700 text-sm">
                    ✓ Sisa biaya sudah memenuhi biaya wajib 1 buku.
                </p>
            ) : (
                <p
                    role="alert"
                    className="text-red-700 text-sm bg-red-500/10 rounded-lg px-3 py-2"
                >
                    Biaya belum cukup — sisa biaya harus sama dengan atau lebih
                    dari biaya wajib{' '}
                    {rupiahFormatter.format(summary.min_book_cost)} per buku
                    (kurang {rupiahFormatter.format(summary.shortfall)}). Tambah
                    bab atau naikkan harga bab.
                </p>
            )}

            <p className="text-oxford-navy-900/55 text-xs">
                Diskon 0–{summary.max_discount}% tidak memengaruhi perhitungan
                ini (fee maksimal editor tetap {summary.max_discount}% dari
                total harga bab) — diskon hanya mengurangi fee yang Anda terima.
                Biaya dan fee berubah seiring total harga bab.
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
