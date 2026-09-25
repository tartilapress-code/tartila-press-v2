<?php

namespace App\Services;

use App\Models\BookChapterSetting;

class BookChapterLimitValidator
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $chapters
     */
    public function assertWithinLimits(array $data, array $chapters, BookChapterSetting $settings): void
    {
        $chapterCount = count($chapters);

        abort_if(
            $chapterCount < $settings->min_chapters,
            422,
            "Jumlah bab minimal {$settings->min_chapters}."
        );

        abort_if(
            $settings->max_chapters && $chapterCount > $settings->max_chapters,
            422,
            "Jumlah bab maksimal {$settings->max_chapters}."
        );

        $price = (float) ($data['price'] ?? 0);
        $discount = (int) ($data['discount'] ?? 0);

        abort_if(
            $price < (float) $settings->min_price,
            422,
            "Harga buku minimal Rp {$settings->min_price}."
        );

        abort_if(
            $discount > $settings->max_discount,
            422,
            "Diskon buku maksimal {$settings->max_discount}%."
        );

        foreach ($chapters as $chapter) {
            if (array_key_exists('price', $chapter) && $chapter['price'] !== null) {
                abort_if(
                    (float) $chapter['price'] < (float) $settings->min_price,
                    422,
                    "Harga bab \"{$chapter['title']}\" tidak boleh di bawah Rp {$settings->min_price}."
                );
            }

            if (array_key_exists('discount', $chapter) && $chapter['discount'] !== null) {
                abort_if(
                    (int) $chapter['discount'] > $settings->max_discount,
                    422,
                    "Diskon bab \"{$chapter['title']}\" tidak boleh di atas {$settings->max_discount}%."
                );
            }
        }
    }
}
