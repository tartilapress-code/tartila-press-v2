<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;

/**
 * Hitungan biaya & fee proyek Book Chapter — satu-satunya sumber rumus
 * (frontend hanya menampilkan pratinjau dengan rumus yang sama).
 *
 *   sisa       = Σ harga bab − biaya HKI − biaya ISBN − biaya fasilitas/layanan
 *   syarat     : sisa ≥ minimal biaya 1 buku (pengaturan admin)
 *   fee editor = (diskon maksimal admin − diskon yang diberikan)% dari harga bab
 *
 * Diskon TIDAK memengaruhi syarat biaya minimal; diskon hanya mengurangi fee
 * editor.
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
        $deductions['total'] = round(array_sum($deductions), 2);

        $chaptersTotal = round($chaptersTotal, 2);
        $net = round($chaptersTotal - $deductions['total'], 2);
        $minimum = (float) $settings->min_book_cost;

        return [
            'chapter_count' => count($chapters),
            'chapters_total' => $chaptersTotal,
            'deductions' => $deductions,
            'net' => $net,
            'min_book_cost' => $minimum,
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
