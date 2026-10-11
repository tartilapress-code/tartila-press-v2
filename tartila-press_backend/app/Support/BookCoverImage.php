<?php

namespace App\Support;

use App\Models\Book;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Foto cover buku dari penyimpanan publik atau tautan luar (aman SSRF),
 * diteruskan lewat domain API supaya kanvas/PDF di browser bisa memakainya
 * tanpa masalah lintas-origin.
 */
final class BookCoverImage
{
    public const MAX_BYTES = 5 * 1024 * 1024;

    /** @return array{bytes: string, mime: string} */
    public static function load(Book $book): array
    {
        $source = trim((string) $book->front_cover);

        abort_if($source === '', 404, 'Buku ini belum punya foto cover.');

        $local = PublicStorageUrl::localPath($source);

        if ($local !== null) {
            try {
                $exists = Storage::disk('public')->exists($local);
            } catch (Throwable) {
                $exists = false; // mis. "../" keluar dari folder publik
            }

            abort_unless($exists, 404, 'Foto cover tidak ditemukan.');

            $mime = strtolower((string) Storage::disk('public')->mimeType($local));
            abort_unless(self::isRasterImage($mime), 404, 'Foto cover bukan gambar.');

            return ['bytes' => Storage::disk('public')->get($local), 'mime' => $mime];
        }

        // Tautan luar: hanya alamat internet publik, ukuran dibatasi.
        $fetched = SafeImageFetcher::fetch($source, self::MAX_BYTES);

        abort_unless($fetched !== null, 404, 'Foto cover tidak dapat diambil.');
        abort_unless(self::isRasterImage($fetched['mime']), 422, 'Foto cover bukan gambar.');

        return $fetched;
    }

    /** Gambar biasa saja (SVG bisa memuat skrip). */
    private static function isRasterImage(string $mime): bool
    {
        return str_starts_with($mime, 'image/') && $mime !== 'image/svg+xml';
    }
}
