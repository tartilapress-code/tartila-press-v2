<?php

namespace App\Support\Certificates;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Menyimpan gambar templat sertifikat yang diunggah admin.
 *
 * Kalau GD tersedia (di server produksi), gambar diubah menjadi JPEG
 * (transparansi dilebur ke putih) dan diperkecil bila lebih dari
 * template_image.max_side_px, supaya PDF hasilnya ringan. Tanpa GD gambar
 * disimpan apa adanya: JPEG selalu bisa, PNG hanya yang tanpa transparansi,
 * tanpa interlace, dan 8-bit (batas pustaka PDF).
 */
final class TemplateImage
{
    /**
     * @return array{path: string, width: int, height: int}
     */
    public static function store(UploadedFile $file): array
    {
        $info = @getimagesize($file->getRealPath());

        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            throw self::invalid('File harus berupa gambar JPG atau PNG yang valid.');
        }

        [$width, $height, $type] = $info;

        if ($width < 300 || $height < 200) {
            throw self::invalid('Gambar terlalu kecil. Gunakan templat dengan lebar minimal 300 px.');
        }

        if ($width * $height > (int) config('certificates.template_image.max_pixels')) {
            throw self::invalid('Resolusi gambar terlalu besar. Perkecil (mis. A4 pada 300 dpi = 3508 x 2480 px).');
        }

        $disk = Storage::disk(config('certificates.template_image.disk'));
        $directory = trim(config('certificates.template_image.directory'), '/');

        if (self::gdAvailable($type)) {
            [$contents, $width, $height] = self::reencode($file->getRealPath(), $type, $width, $height);
            $path = $directory.'/'.Str::uuid().'.jpg';
            $disk->put($path, $contents);

            return ['path' => $path, 'width' => $width, 'height' => $height];
        }

        if ($type === IMAGETYPE_PNG) {
            self::assertPlainPng($file->getRealPath());
        }

        $path = $directory.'/'.Str::uuid().($type === IMAGETYPE_PNG ? '.png' : '.jpg');
        $disk->put($path, (string) file_get_contents($file->getRealPath()));

        return ['path' => $path, 'width' => $width, 'height' => $height];
    }

    public static function delete(?string $path): void
    {
        if ($path && str_starts_with($path, trim(config('certificates.template_image.directory'), '/').'/')) {
            Storage::disk(config('certificates.template_image.disk'))->delete($path);
        }
    }

    /**
     * Apakah path ini gambar templat yang sah dan ada di disk?
     */
    public static function isStored(string $path): bool
    {
        $directory = preg_quote(trim(config('certificates.template_image.directory'), '/'), '#');

        return preg_match('#^'.$directory.'/[A-Za-z0-9-]+\.(jpg|png)$#', $path) === 1
            && Storage::disk(config('certificates.template_image.disk'))->exists($path);
    }

    private static function gdAvailable(int $type): bool
    {
        return function_exists('imagejpeg')
            && function_exists($type === IMAGETYPE_PNG ? 'imagecreatefrompng' : 'imagecreatefromjpeg');
    }

    /**
     * @return array{0: string, 1: int, 2: int} [isi JPEG, lebar, tinggi]
     */
    private static function reencode(string $file, int $type, int $width, int $height): array
    {
        $maxSide = (int) config('certificates.template_image.max_side_px');
        $scale = min(1.0, $maxSide / max($width, $height));
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));

        self::assertEnoughMemory($width, $height, $targetWidth, $targetHeight);

        $source = $type === IMAGETYPE_PNG ? @imagecreatefrompng($file) : @imagecreatefromjpeg($file);

        if (! $source) {
            throw self::invalid('Gambar tidak bisa dibaca. Coba ekspor ulang dari aplikasi desain Anda.');
        }

        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        ob_start();
        imagejpeg($canvas, null, (int) config('certificates.template_image.jpeg_quality'));
        $contents = (string) ob_get_clean();

        return [$contents, $targetWidth, $targetHeight];
    }

    /**
     * GD memakai ±4 byte per piksel untuk gambar sumber dan kanvas hasil. Kehabisan
     * memori adalah galat fatal yang tidak bisa ditangkap, jadi gambar yang
     * pasti tak muat ditolak sebelum didekode.
     */
    private static function assertEnoughMemory(int $width, int $height, int $targetWidth, int $targetHeight): void
    {
        $limit = self::memoryLimitBytes();

        if ($limit < 0) {
            return;
        }

        $needed = (int) (($width * $height * 4 + $targetWidth * $targetHeight * 4) * 1.25) + 16 * 1048576;

        if ($limit - memory_get_usage(true) < $needed) {
            throw self::invalid('Gambar terlalu besar untuk diproses server. Perkecil resolusinya (mis. A4 pada 300 dpi = 3508 x 2480 px).');
        }
    }

    private static function memoryLimitBytes(): int
    {
        $value = trim((string) ini_get('memory_limit'));

        if ($value === '' || $value === '-1') {
            return -1;
        }

        $number = (int) $value;

        return match (strtolower(substr($value, -1))) {
            'g' => $number * 1073741824,
            'm' => $number * 1048576,
            'k' => $number * 1024,
            default => $number,
        };
    }

    private static function assertPlainPng(string $file): void
    {
        $header = (string) file_get_contents($file, false, null, 0, 33);

        $bitDepth = ord($header[24] ?? "\0");
        $colorType = ord($header[25] ?? "\0");
        $interlace = ord($header[28] ?? "\0");

        if (in_array($colorType, [4, 6], true) || $interlace !== 0 || $bitDepth > 8) {
            throw self::invalid(
                'Server ini belum bisa memproses PNG transparan/interlaced/16-bit. '
                .'Ekspor ulang tanpa transparansi, atau unggah dalam format JPG.'
            );
        }
    }

    private static function invalid(string $message): ValidationException
    {
        return ValidationException::withMessages(['image' => [$message]]);
    }
}
