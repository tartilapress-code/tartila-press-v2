<?php

namespace App\Support\Certificates;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

/**
 * Daftar font untuk sertifikat (config/certificates.php) dan cache metrik
 * tFPDF-nya.
 */
final class CertificateFonts
{
    public const DEFAULT_FONT = 'montserrat';

    /**
     * @return array<string, array{label: string, category: string, file: string, bold: bool, ascent: float, descent: float}>
     */
    public static function all(): array
    {
        return config('certificates.fonts', []);
    }

    public static function has(string $key): bool
    {
        return array_key_exists($key, self::all());
    }

    public static function directory(): string
    {
        return rtrim(config('certificates.font_path'), '/\\').DIRECTORY_SEPARATOR.'unifont';
    }

    /**
     * Gaya yang benar-benar dipakai: huruf tebal hanya kalau font punya
     * berkasnya, kalau tidak jatuh ke reguler.
     */
    public static function style(string $key, bool $bold): string
    {
        return $bold && (self::all()[$key]['bold'] ?? false) ? 'B' : '';
    }

    public static function fileName(string $key, string $style): string
    {
        $stem = self::all()[$key]['file'];

        return $stem.($style === 'B' ? '-Bold' : '-Regular').'.ttf';
    }

    /**
     * @return array{ascent: float, descent: float}
     */
    public static function metrics(string $key): array
    {
        $font = self::all()[$key];

        return ['ascent' => (float) $font['ascent'], 'descent' => (float) $font['descent']];
    }

    /**
     * Nama berkas TTF yang boleh diunduh frontend (untuk pratinjau editor).
     *
     * @return list<string>
     */
    public static function publicFiles(): array
    {
        $files = [];

        foreach (self::all() as $key => $font) {
            $files[] = self::fileName($key, '');

            if ($font['bold']) {
                $files[] = self::fileName($key, 'B');
            }
        }

        return $files;
    }

    public static function pathOf(string $file): ?string
    {
        if (! in_array($file, self::publicFiles(), true)) {
            return null;
        }

        $path = self::directory().DIRECTORY_SEPARATOR.$file;

        return is_file($path) ? $path : null;
    }

    /**
     * Untuk endpoint meta: data font yang dibutuhkan editor.
     *
     * @return list<array<string, mixed>>
     */
    public static function meta(): array
    {
        return collect(self::all())->map(fn (array $font, string $key) => [
            'key' => $key,
            'label' => $font['label'],
            'category' => $font['category'],
            'ascent' => (float) $font['ascent'],
            'descent' => (float) $font['descent'],
            'regular_file' => self::fileName($key, ''),
            'bold_file' => $font['bold'] ? self::fileName($key, 'B') : null,
        ])->values()->all();
    }

    /**
     * Pastikan cache metrik tFPDF untuk font-font ini sudah ada. tFPDF
     * membuatnya sendiri saat font pertama kali dipakai, tetapi dua
     * permintaan bersamaan di saat itu bisa saling membaca berkas yang masih
     * setengah tertulis -- jadi pembuatannya dikunci.
     *
     * @param  list<array{0: string, 1: string}>  $fonts  pasangan [kunci, gaya ''|'B']
     */
    public static function warm(array $fonts): void
    {
        $missing = array_filter($fonts, fn (array $font) => ! self::isCached($font[0], $font[1]));

        if ($missing === []) {
            return;
        }

        $generate = function () use ($missing) {
            $pdf = self::newPdf();
            $pdf->AddPage();

            foreach ($missing as [$key, $style]) {
                if (self::isCached($key, $style)) {
                    continue;
                }

                $pdf->AddFont($key, $style, self::fileName($key, $style), true);
                $pdf->SetFont($key, $style, 12);
                // Satu huruf di atas U+007F memicu pembuatan cache lebar >127.
                $pdf->Text(10, 20, 'Aé');
            }

            $pdf->Output('S');
        };

        try {
            Cache::lock('certificate-fonts-warm', 120)->block(60, $generate);
        } catch (LockTimeoutException) {
            // Kunci tak didapat dalam 60 detik: lanjut saja, tFPDF akan membuat
            // atau membaca cache-nya sendiri.
        }
    }

    public static function newPdf(string $orientation = 'P', array|string $size = 'A4'): \tFPDF
    {
        if (! defined('FPDF_FONTPATH')) {
            define('FPDF_FONTPATH', rtrim(config('certificates.font_path'), '/\\'));
        }

        $pdf = new \tFPDF($orientation, 'pt', $size);
        $pdf->SetAutoPageBreak(false);
        $pdf->SetMargins(0, 0, 0);

        return $pdf;
    }

    private static function isCached(string $key, string $style): bool
    {
        $stem = strtolower(pathinfo(self::fileName($key, $style), PATHINFO_FILENAME));

        return File::exists(self::directory().DIRECTORY_SEPARATOR.$stem.'.mtx.php');
    }
}
