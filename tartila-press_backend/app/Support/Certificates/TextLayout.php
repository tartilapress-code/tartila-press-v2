<?php

namespace App\Support\Certificates;

/**
 * Tata letak teks di dalam kotak: pemotongan baris, pengecilan otomatis
 * (auto-fit), dan posisi tiap baris.
 *
 * Algoritma ini DIDUPLIKASI di frontend (src/lib/certificateLayout.ts) supaya
 * pratinjau di editor identik dengan PDF. Kalau salah satunya diubah, ubah
 * keduanya.
 */
final class TextLayout
{
    private const STEP_PT = 0.5;

    private const EPSILON = 0.01;

    /**
     * Memecah teks menjadi baris dengan lebar maksimum $maxWidth (poin).
     * Baris baru yang diketik admin dipertahankan; satu kata yang lebih
     * panjang dari kotak tetap ditaruh utuh di barisnya sendiri.
     *
     * @param  callable(string): float  $measure  lebar string pada ukuran 1pt
     * @return list<string>
     */
    public static function wrap(callable $measure, string $text, float $size, float $maxWidth): array
    {
        $lines = [];

        foreach (preg_split('/\r\n|\r|\n/', $text) as $paragraph) {
            $words = preg_split('/\s+/u', trim($paragraph), -1, PREG_SPLIT_NO_EMPTY);

            if ($words === []) {
                $lines[] = '';

                continue;
            }

            $line = '';

            foreach ($words as $word) {
                $candidate = $line === '' ? $word : $line.' '.$word;

                if ($line === '' || $measure($candidate) * $size <= $maxWidth) {
                    $line = $candidate;
                } else {
                    $lines[] = $line;
                    $line = $word;
                }
            }

            $lines[] = $line;
        }

        while ($lines !== [] && end($lines) === '') {
            array_pop($lines);
        }

        return $lines;
    }

    /**
     * Menentukan ukuran huruf dan baris. Dengan $autoFit, ukuran dikecilkan
     * 0,5pt demi 0,5pt (sampai batas minimum) hingga seluruh teks muat di
     * kotak $boxWidth x $boxHeight.
     *
     * @param  callable(string): float  $measure  lebar string pada ukuran 1pt
     * @return array{size: float, lines: list<string>, line_height: float}
     */
    public static function fit(callable $measure, string $text, float $boxWidth, float $boxHeight, float $size, bool $autoFit): array
    {
        $lineFactor = (float) config('certificates.line_height');
        $minSize = max(
            (float) config('certificates.min_font_size_pt'),
            $size * (float) config('certificates.min_font_size_ratio')
        );

        $current = $size;

        while (true) {
            $lines = self::wrap($measure, $text, $current, $boxWidth);
            $lineHeight = $current * $lineFactor;

            $widest = 0.0;
            foreach ($lines as $line) {
                $widest = max($widest, $measure($line) * $current);
            }

            $fits = count($lines) * $lineHeight <= $boxHeight + self::EPSILON
                && $widest <= $boxWidth + self::EPSILON;

            if (! $autoFit || $fits || $current <= $minSize + 1e-9) {
                break;
            }

            $current = max($minSize, $current - self::STEP_PT);
        }

        return ['size' => $current, 'lines' => $lines, 'line_height' => $lineHeight];
    }

    /**
     * Posisi tiap baris: [x, garis dasar y] dalam poin, dihitung dari
     * pojok kiri atas halaman.
     *
     * @param  array{size: float, lines: list<string>, line_height: float}  $layout
     * @param  callable(string): float  $measure  lebar string pada ukuran 1pt
     * @return list<array{text: string, x: float, y: float}>
     */
    public static function place(
        callable $measure,
        array $layout,
        float $boxX,
        float $boxY,
        float $boxWidth,
        float $boxHeight,
        string $align,
        string $valign,
        float $ascent,
        float $descent,
    ): array {
        $size = $layout['size'];
        $lineHeight = $layout['line_height'];
        $blockHeight = count($layout['lines']) * $lineHeight;

        $top = match ($valign) {
            'top' => $boxY,
            'bottom' => $boxY + $boxHeight - $blockHeight,
            default => $boxY + ($boxHeight - $blockHeight) / 2,
        };

        $placed = [];

        foreach ($layout['lines'] as $index => $line) {
            $lineTop = $top + $index * $lineHeight;
            $baseline = $lineTop + ($lineHeight - ($ascent + $descent) * $size) / 2 + $ascent * $size;
            $width = $measure($line) * $size;

            $x = match ($align) {
                'left' => $boxX,
                'right' => $boxX + $boxWidth - $width,
                default => $boxX + ($boxWidth - $width) / 2,
            };

            $placed[] = ['text' => $line, 'x' => $x, 'y' => $baseline];
        }

        return $placed;
    }
}
