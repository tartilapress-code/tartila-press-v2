/**
 * Pratinjau biaya & fee proyek Book Chapter di browser. Rumusnya SAMA dengan
 * backend (App\Services\BookChapterCostCalculator) — backend tetap yang
 * menentukan (menolak simpan/ubah/hapus bila sisa biaya di bawah minimal).
 *
 *   a = Σ harga bab        b = biaya HKI     c = biaya ISBN
 *   d = fasilitas/layanan  e = biaya wajib (minimal biaya total 1 buku, pengaturan admin)
 *   f = fee maksimal editor = P% × a, P = diskon maksimal admin (hanya bila proyek punya
 *       editor pemilik); bertambah seiring total harga bab
 *
 *   biaya        = b + c + d + e + f          (total biaya wajib 1 proyek)
 *   syarat       : a ≥ biaya  (boleh tepat sama)
 *   sisa         = a − (b + c + d + f), dan syarat di atas ≡ sisa ≥ e
 *
 * Perkiraan awal (sebelum bab lengkap): biaya ≈ (b+c+d+e) + P% × (b+c+d+e).
 *
 * Fee yang DITERIMA editor lain lagi: (P − diskon yang diberikan)% × harga bab. Diskon
 * (0–P%) TIDAK memengaruhi syarat biaya; diskon hanya mengurangi fee yang diterima editor.
 */

import { isbnFromFlags, type IsbnType } from '@/lib/isbnTypes';

export type BookChapterCostSettings = {
    min_chapters: number;
    max_chapters: number | null;
    min_price: string | number;
    max_discount: number;
    hki_cost: string | number;
    isbn_print_cost: string | number;
    isbn_electronic_cost: string | number;
    min_book_cost: string | number;
    // Minimal biaya 1 buku per jenis ISBN; kosong = ikut min_book_cost.
    min_book_cost_print?: string | number | null;
    min_book_cost_electronic?: string | number | null;
    min_book_cost_both?: string | number | null;
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
    // Jenis ISBN proyek (cetak / digital / keduanya); wajib dipilih saat membuat proyek.
    isbn_type: IsbnType | null;
    package_item_ids: number[];
};

export const emptyPackageOptions: PackageOptions = {
    includes_hki: false,
    includes_isbn_print: false,
    includes_isbn_electronic: false,
    isbn_type: null,
    package_item_ids: [],
};

export type CostInput = PackageOptions & {
    // Harga & diskon bawaan proyek; bab yang kosong mengikutinya.
    price: number;
    discount: number;
    chapters: { price?: number | null; discount?: number | null }[];
    // Proyek punya editor pemilik: fee maksimalnya ikut dipotong dari sisa biaya.
    has_owner_editor: boolean;
};

export type CostSummary = {
    chapter_count: number;
    chapters_total: number;
    deductions: {
        hki: number;
        isbn_print: number;
        isbn_electronic: number;
        items: number;
        // Fee maksimal editor = P% × total harga bab; 0 bila tak ada editor pemilik.
        max_fee: number;
        total: number;
    };
    net: number;
    isbn_type: IsbnType | null;
    min_book_cost: number;
    // Biaya = biaya wajib + HKI + ISBN + fasilitas/layanan + fee maksimal editor.
    required_total: number;
    // Perkiraan awal sebelum bab lengkap: (b+c+d+e) + P% × (b+c+d+e).
    estimated_required: number;
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

/** Biaya minimal 1 buku untuk satu jenis ISBN (belum diisi / jenis belum dipilih = nilai umum). */
export function minimumFor(
    settings: BookChapterCostSettings,
    type: IsbnType | null
): number {
    const byType = {
        print: settings.min_book_cost_print,
        electronic: settings.min_book_cost_electronic,
        both: settings.min_book_cost_both,
    };
    const value = type ? byType[type] : null;

    return toNumber(value ?? settings.min_book_cost);
}

/** Biaya ISBN yang dipotong untuk satu jenis (keduanya = cetak + digital). */
export function isbnCostFor(
    settings: BookChapterCostSettings,
    type: IsbnType
): number {
    const print = toNumber(settings.isbn_print_cost);
    const electronic = toNumber(settings.isbn_electronic_cost);

    return type === 'print'
        ? print
        : type === 'electronic'
          ? electronic
          : print + electronic;
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
        max_fee: 0,
        total: 0,
    };
    chaptersTotal = roundMoney(chaptersTotal);

    // Biaya wajib (e) mengikuti jenis ISBN (cetak / digital / keduanya).
    const isbnType =
        input.isbn_type ??
        isbnFromFlags(
            input.includes_isbn_print,
            input.includes_isbn_electronic
        );
    const minimum = minimumFor(settings, isbnType);

    // f = P% × a: fee maksimal editor mengikuti total harga bab (tanpa diskon yang diberikan).
    const costBase = roundMoney(
        deductions.hki +
            deductions.isbn_print +
            deductions.isbn_electronic +
            deductions.items +
            minimum
    );
    deductions.max_fee = input.has_owner_editor
        ? roundMoney((chaptersTotal * Math.max(0, maxDiscount)) / 100)
        : 0;
    deductions.total = roundMoney(
        deductions.hki +
            deductions.isbn_print +
            deductions.isbn_electronic +
            deductions.items +
            deductions.max_fee
    );

    const net = roundMoney(chaptersTotal - deductions.total);

    return {
        chapter_count: input.chapters.length,
        chapters_total: chaptersTotal,
        deductions,
        net,
        isbn_type: isbnType,
        min_book_cost: minimum,
        required_total: roundMoney(minimum + deductions.total),
        estimated_required: input.has_owner_editor
            ? roundMoney(costBase * (1 + Math.max(0, maxDiscount) / 100))
            : costBase,
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
