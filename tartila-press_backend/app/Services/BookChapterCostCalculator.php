<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Support\IsbnTypes;

/**
 * Hitungan biaya & fee proyek Book Chapter — satu-satunya sumber rumus
 * (frontend hanya menampilkan pratinjau dengan rumus yang sama).
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
 * Perkiraan awal (sebelum bab lengkap, a belum diketahui): biaya ≈ (b+c+d+e) + P% × (b+c+d+e).
 *
 * Fee yang DITERIMA editor lain lagi: (P − diskon yang diberikan)% × harga bab. Diskon
 * (0–P%) TIDAK memengaruhi syarat biaya (fee dipotong pada P% penuh); diskon hanya
 * mengurangi fee yang diterima editor.
 */
class BookChapterCostCalculator
{
    /**
     * @param  array{
     *     price?: mixed,
     *     discount?: mixed,
     *     chapters?: array<int|string, array{price?: mixed, discount?: mixed}>,
     *     includes_hki?: bool,
     *     includes_isbn_print?: bool,
     *     includes_isbn_electronic?: bool,
     *     has_owner_editor?: bool,
     *     isbn_type?: string|null,
     *     item_costs?: array<int, mixed>
     * }  $input  Harga/diskon bab yang kosong ikut harga/diskon proyek.
     * @return array<string, mixed>
     */
    public function calculate(array $input, BookChapterSetting $settings): array
    {
        $defaultPrice = (float) ($input['price'] ?? 0);
        $defaultDiscount = (int) ($input['discount'] ?? 0);
        $maxDiscount = (int) $settings->max_discount;

        $chaptersTotal = 0.0;
        $potentialFee = 0.0;
        $chapterFees = [];
        $chapters = $input['chapters'] ?? [];

        foreach ($chapters as $key => $chapter) {
            $price = $this->filled($chapter['price'] ?? null)
                ? (float) $chapter['price']
                : $defaultPrice;
            $discount = $this->filled($chapter['discount'] ?? null)
                ? (int) $chapter['discount']
                : $defaultDiscount;

            $chapterFee = round($price * max(0, $maxDiscount - $discount) / 100, 2);

            $chaptersTotal += $price;
            $potentialFee += $chapterFee;
            $chapterFees[$key] = $chapterFee;
        }

        $deductions = [
            'hki' => ! empty($input['includes_hki']) ? (float) $settings->hki_cost : 0.0,
            'isbn_print' => ! empty($input['includes_isbn_print']) ? (float) $settings->isbn_print_cost : 0.0,
            'isbn_electronic' => ! empty($input['includes_isbn_electronic']) ? (float) $settings->isbn_electronic_cost : 0.0,
            'items' => (float) collect($input['item_costs'] ?? [])
                ->sum(fn ($cost) => (float) ($cost ?? 0)),
        ];
        $chaptersTotal = round($chaptersTotal, 2);

        // Biaya wajib (e) mengikuti jenis ISBN (cetak / digital / keduanya).
        $isbnType = $input['isbn_type'] ?? IsbnTypes::fromFlags(! empty($input['includes_isbn_print']), ! empty($input['includes_isbn_electronic']));
        $minimum = $settings->minimumFor($isbnType);

        // f = P% × a: fee maksimal editor mengikuti total harga bab, tanpa memperhitungkan
        // diskon yang diberikan.
        $costBase = round(array_sum($deductions) + $minimum, 2);
        $hasOwner = ! empty($input['has_owner_editor']);
        $deductions['max_fee'] = $hasOwner
            ? round($chaptersTotal * max(0, $maxDiscount) / 100, 2)
            : 0.0;
        $deductions['total'] = round(array_sum($deductions), 2);

        $net = round($chaptersTotal - $deductions['total'], 2);
        // Biaya = b + c + d + e + f.
        $required = round($minimum + $deductions['total'], 2);

        return [
            'chapter_count' => count($chapters),
            'chapters_total' => $chaptersTotal,
            'deductions' => $deductions,
            'net' => $net,
            'isbn_type' => $isbnType,
            'min_book_cost' => $minimum,
            // Biaya = biaya wajib + HKI + ISBN + fasilitas/layanan + fee maksimal editor.
            'required_total' => $required,
            // Perkiraan awal sebelum bab lengkap: (b+c+d+e) + P% × (b+c+d+e).
            'estimated_required' => $hasOwner ? round($costBase * (1 + max(0, $maxDiscount) / 100), 2) : $costBase,
            // a ≥ biaya  ⇔  sisa ≥ biaya wajib (boleh tepat sama).
            'meets_minimum' => $net + 0.005 >= $minimum,
            'shortfall' => round(max(0, $minimum - $net), 2),
            'max_discount' => $maxDiscount,
            'fee_percent' => max(0, $maxDiscount - $defaultDiscount),
            'potential_fee' => round($potentialFee, 2),
            'chapter_fees' => $chapterFees,
        ];
    }

    /**
     * Masukan hitungan dari proyek yang sudah tersimpan. Kunci bab = id bab,
     * supaya satu bab bisa diganti/dibuang saat mensimulasikan perubahan.
     *
     * @return array<string, mixed>
     */
    public function inputFromBook(Book $book): array
    {
        $book->loadMissing(['chapters', 'packageItems']);

        return [
            'price' => $book->price,
            'discount' => $book->discount,
            'chapters' => $book->chapters->mapWithKeys(fn (BookChapter $chapter) => [
                $chapter->id => ['price' => $chapter->price, 'discount' => $chapter->discount],
            ])->all(),
            'includes_hki' => (bool) $book->includes_hki,
            'includes_isbn_print' => (bool) $book->includes_isbn_print,
            'includes_isbn_electronic' => (bool) $book->includes_isbn_electronic,
            'has_owner_editor' => $book->owner_editor_id !== null,
            'isbn_type' => $book->isbn_type ?? IsbnTypes::fromFlags((bool) $book->includes_isbn_print, (bool) $book->includes_isbn_electronic),
            'item_costs' => $book->packageItems->pluck('book_chapter_cost')->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function summarize(Book $book, BookChapterSetting $settings): array
    {
        return $this->calculate($this->inputFromBook($book), $settings);
    }

    private function filled(mixed $value): bool
    {
        return $value !== null && $value !== '';
    }
}
