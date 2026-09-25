<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Models\CustomPackageItem;

/**
 * Aturan biaya minimal 1 buku untuk proyek Book Chapter.
 *
 * - Proyek baru buatan editor: sisa biaya harus memenuhi minimal.
 * - Mengubah proyek / mengubah atau menghapus bab (editor & admin): hasil
 *   akhirnya tidak boleh di bawah minimal. Proyek yang SUDAH di bawah minimal
 *   (mis. dibuat admin sebelum aturan ini) tetap boleh diubah selama
 *   perubahannya tidak memperburuk sisa biayanya.
 */
class BookChapterCostGuard
{
    public function __construct(
        private readonly BookChapterCostCalculator $calculator,
    ) {}

    /**
     * @param  array<string, mixed>  $project  hasil validasi (price, discount, includes_*)
     * @param  array<int, array<string, mixed>>  $chapters
     * @param  array<int, int>  $itemIds
     */
    public function assertNewProjectMeetsMinimum(
        array $project,
        array $chapters,
        array $itemIds,
        BookChapterSetting $settings,
    ): void {
        $summary = $this->calculator->calculate([
            'price' => $project['price'] ?? 0,
            'discount' => $project['discount'] ?? 0,
            'chapters' => $chapters,
            'includes_hki' => (bool) ($project['includes_hki'] ?? false),
            'includes_isbn_print' => (bool) ($project['includes_isbn_print'] ?? false),
            'includes_isbn_electronic' => (bool) ($project['includes_isbn_electronic'] ?? false),
            'item_costs' => $this->itemCosts($itemIds),
        ], $settings);

        abort_unless($summary['meets_minimum'], 422, $this->newProjectMessage($summary));
    }

    /**
     * @param  array<string, mixed>  $changes  price, discount, includes_*, package_item_ids
     */
    public function assertProjectChangeAllowed(Book $book, array $changes, BookChapterSetting $settings): void
    {
        $before = $this->calculator->inputFromBook($book);
        $after = $before;

        foreach (['price', 'discount', 'includes_hki', 'includes_isbn_print', 'includes_isbn_electronic'] as $key) {
            if (array_key_exists($key, $changes) && $changes[$key] !== null) {
                $after[$key] = $changes[$key];
            }
        }

        if (array_key_exists('package_item_ids', $changes)) {
            $after['item_costs'] = $this->itemCosts($changes['package_item_ids'] ?? []);
        }

        $this->assertNotWorse($before, $after, $settings);
    }

    /**
     * @param  array<string, mixed>  $changes  price, discount (null = ikut proyek)
     */
    public function assertChapterChangeAllowed(BookChapter $chapter, array $changes, BookChapterSetting $settings): void
    {
        $before = $this->calculator->inputFromBook($chapter->book);
        $after = $before;

        foreach (['price', 'discount'] as $key) {
            if (array_key_exists($key, $changes)) {
                $after['chapters'][$chapter->id][$key] = $changes[$key];
            }
        }

        $this->assertNotWorse($before, $after, $settings);
    }

    public function assertChapterDeleteAllowed(BookChapter $chapter, BookChapterSetting $settings): void
    {
        $before = $this->calculator->inputFromBook($chapter->book);
        $after = $before;
        unset($after['chapters'][$chapter->id]);

        $this->assertNotWorse($before, $after, $settings);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function assertNotWorse(array $before, array $after, BookChapterSetting $settings): void
    {
        $afterSummary = $this->calculator->calculate($after, $settings);

        if ($afterSummary['meets_minimum']) {
            return;
        }

        $beforeSummary = $this->calculator->calculate($before, $settings);

        if ($afterSummary['net'] >= $beforeSummary['net']) {
            return;
        }

        abort(422, sprintf(
            'Perubahan ditolak: sisa biaya 1 buku menjadi %s, di bawah minimal %s (kurang %s). Tambah bab atau naikkan harga bab terlebih dahulu.',
            $this->rupiah($afterSummary['net']),
            $this->rupiah($afterSummary['min_book_cost']),
            $this->rupiah($afterSummary['shortfall'])
        ));
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    private function newProjectMessage(array $summary): string
    {
        return sprintf(
            'Biaya 1 buku belum cukup: total harga bab %s dikurangi biaya HKI/ISBN/layanan %s = %s, kurang %s dari minimal %s. Tambah bab atau naikkan harga bab.',
            $this->rupiah($summary['chapters_total']),
            $this->rupiah($summary['deductions']['total']),
            $this->rupiah($summary['net']),
            $this->rupiah($summary['shortfall']),
            $this->rupiah($summary['min_book_cost'])
        );
    }

    /**
     * @param  array<int, int|string>  $itemIds
     * @return array<int, mixed>
     */
    private function itemCosts(array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        return CustomPackageItem::whereIn('id', $itemIds)->pluck('book_chapter_cost')->all();
    }

    private function rupiah(float $amount): string
    {
        return ($amount < 0 ? '-' : '').'Rp '.number_format(abs($amount), 0, ',', '.');
    }
}
