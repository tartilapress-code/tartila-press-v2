<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Versi kecil (WebP) dari gambar unggahan untuk ditampilkan di kartu & daftar:
 * "uploads/covers/1/abc.png" -> "uploads/covers/1/abc.w400.webp" & ".w900.webp".
 * Berkas asli tidak diubah (tetap dipakai untuk halaman detail, unduhan, PDF).
 * Frontend menyusun nama varian dengan aturan yang sama (src/lib/responsiveImage.ts)
 * dan kembali ke berkas asli bila varian belum ada.
 */
class ResponsiveImages
{
    /** Lebar varian (px). Harus sama dengan VARIANT_WIDTHS di frontend. */
    public const WIDTHS = [400, 900];

    private const QUALITY = 80;

    // Batas aman memori GD (± 4 byte per piksel).
    private const MAX_PIXELS = 40_000_000;

    public static function supported(): bool
    {
        return function_exists('imagecreatefromstring') && function_exists('imagewebp');
    }

    public static function isSource(string $path): bool
    {
        return (bool) preg_match('/\.(jpe?g|png|webp)$/i', $path) && ! self::isVariant($path);
    }

    public static function isVariant(string $path): bool
    {
        return (bool) preg_match('/\.w\d+\.webp$/i', $path);
    }

    public static function variantPath(string $path, int $width): string
    {
        return preg_replace('/\.[^.\/]+$/', '', $path).".w{$width}.webp";
    }

    /**
     * Buat varian yang belum ada untuk satu gambar di disk public.
     * Tidak pernah melempar galat: unggahan tetap berhasil walau varian gagal.
     *
     * @return int jumlah varian yang dibuat
     */
    public function generate(string $path, bool $force = false): int
    {
        if (! self::supported() || ! self::isSource($path)) {
            return 0;
        }

        $disk = Storage::disk('public');
        $missing = array_values(array_filter(
            self::WIDTHS,
            fn (int $width) => $force || ! $disk->exists(self::variantPath($path, $width))
        ));

        if ($missing === [] || ! $disk->exists($path)) {
            return 0;
        }

        try {
            $absolute = $disk->path($path);
            $size = @getimagesize($absolute);

            if (! $size || $size[0] * $size[1] > self::MAX_PIXELS) {
                return 0;
            }

            $source = @imagecreatefromstring((string) file_get_contents($absolute));

            if (! $source) {
                return 0;
            }

            $source = $this->applyExifOrientation($source, $absolute, $size[2] ?? null);
            $sourceWidth = imagesx($source);
            $sourceHeight = imagesy($source);
            $created = 0;

            foreach ($missing as $width) {
                $targetWidth = min($width, $sourceWidth); // tidak pernah diperbesar
                $targetHeight = max(1, (int) round($sourceHeight * $targetWidth / $sourceWidth));

                $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
                imagealphablending($canvas, false);
                imagesavealpha($canvas, true);
                imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
                imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);

                ob_start();
                imagewebp($canvas, null, self::QUALITY);
                $data = (string) ob_get_clean();
                imagedestroy($canvas);

                if ($data !== '') {
                    $disk->put(self::variantPath($path, $width), $data);
                    $created++;
                }
            }

            imagedestroy($source);

            return $created;
        } catch (Throwable $exception) {
            report($exception);

            return 0;
        }
    }

    /** Foto HP menyimpan arah putar di EXIF; varian WebP tidak membawa EXIF, jadi diputar di sini. */
    private function applyExifOrientation(\GdImage $image, string $absolute, ?int $type): \GdImage
    {
        if ($type !== IMAGETYPE_JPEG || ! function_exists('exif_read_data')) {
            return $image;
        }

        $orientation = (int) (@exif_read_data($absolute)['Orientation'] ?? 1);

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        if ($rotated !== $image && $rotated !== false) {
            imagedestroy($image);

            return $rotated;
        }

        return $image;
    }
}
