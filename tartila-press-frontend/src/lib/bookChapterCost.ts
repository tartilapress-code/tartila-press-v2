/**
 * Pratinjau biaya & fee proyek Book Chapter di browser. Rumusnya SAMA dengan
 * backend (App\Services\BookChapterCostCalculator) — backend tetap yang
 * menentukan (menolak simpan/ubah/hapus bila sisa biaya di bawah minimal).
 *
 *   sisa       = Σ harga bab − biaya HKI − biaya ISBN − biaya fasilitas/layanan
 *   syarat     : sisa ≥ minimal biaya 1 buku (pengaturan admin)
 *   fee editor = (diskon maksimal admin − diskon yang diberikan)% dari harga bab
 *
 * Diskon TIDAK memengaruhi syarat biaya minimal; diskon hanya mengurangi fee
 * editor.
 */

export type BookChapterCostSettings = {
    min_chapters: number;
    max_chapters: number | null;
    min_price: string | number;
    max_discount: number;
    hki_cost: string | number;
    isbn_print_cost: string | number;
    isbn_electronic_cost: string | number;
    min_book_cost: string | number;
};

export type PackageItem = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    description: string | null;
    // Biaya item di proyek Book Chapter; null = gratis.
    book_chapter_cost: string | number | null;
};

export type PackageOptions = {
    includes_hki: boolean;
    includes_isbn_print: boolean;
    includes_isbn_electronic: boolean;
    package_item_ids: number[];
};

export const emptyPackageOptions: PackageOptions = {
    includes_hki: false,
    includes_isbn_print: false,
    includes_isbn_electronic: false,
    package_item_ids: [],
};

export type CostInput = PackageOptions & {
    // Harga & diskon bawaan proyek; bab yang kosong mengikutinya.
    price: number;
    discount: number;
    chapters: { price?: number | null; discount?: number | null }[];
};

export type CostSummary = {
    chapter_count: number;
    chapters_total: number;
    deductions: {
        hki: number;
        isbn_print: number;
        isbn_electronic: number;
        items: number;
        total: number;
    };
    net: number;
    min_book_cost: number;
    meets_minimum: boolean;
    shortfall: number;
    max_discount: number;
    fee_percent: number;
    potential_fee: number;
};

export function toNumber(value: string | number | null | undefined): number {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

export function calculateBookChapterCost(
    input: CostInput,
    settings: BookChapterCostSettings,
    items: PackageItem[]
): CostSummary {
    const maxDiscount = toNumber(settings.max_discount);

    let chaptersTotal = 0;
    let potentialFee = 0;

    for (const chapter of input.chapters) {
        const price = chapter.price ?? input.price;
        const discount = chapter.discount ?? input.discount;

        chaptersTotal += price;
        potentialFee += roundMoney(
            (price * Math.max(0, maxDiscount - discount)) / 100
        );
    }

    const selected = new Set(input.package_item_ids);
    const deductions = {
        hki: input.includes_hki ? toNumber(settings.hki_cost) : 0,
        isbn_print: input.includes_isbn_print
            ? toNumber(settings.isbn_print_cost)
            : 0,
        isbn_electronic: input.includes_isbn_electronic
            ? toNumber(settings.isbn_electronic_cost)
            : 0,
        items: items
            .filter((item) => selected.has(item.id))
            .reduce((sum, item) => sum + toNumber(item.book_chapter_cost), 0),
        total: 0,
    };
    deductions.total = roundMoney(
        deductions.hki +
            deductions.isbn_print +
            deductions.isbn_electronic +
            deductions.items
    );

    chaptersTotal = roundMoney(chaptersTotal);
    const net = roundMoney(chaptersTotal - deductions.total);
    const minimum = toNumber(settings.min_book_cost);

    return {
        chapter_count: input.chapters.length,
        chapters_total: chaptersTotal,
        deductions,
        net,
        min_book_cost: minimum,
        meets_minimum: net + 0.005 >= minimum,
        shortfall: roundMoney(Math.max(0, minimum - net)),
        max_discount: maxDiscount,
        fee_percent: Math.max(0, maxDiscount - input.discount),
        potential_fee: roundMoney(potentialFee),
    };
}

/** Isian bab pada form ("" = ikut proyek) → masukan hitungan. */
export function chapterRowsToCostInput(
    rows: { price: string; discount: string }[]
): CostInput['chapters'] {
    return rows.map((row) => ({
        price: row.price.trim() === '' ? null : toNumber(row.price),
        discount: row.discount.trim() === '' ? null : toNumber(row.discount),
    }));
}
