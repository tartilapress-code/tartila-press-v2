<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * URL berkas yang kita simpan sendiri di disk "public" (hasil upload) →
 * path di disk itu, supaya berkasnya dibaca langsung tanpa lewat HTTP.
 */
final class PublicStorageUrl
{
    /** Path di disk publik kalau $source menunjuk berkas kita sendiri; null kalau URL luar. */
    public static function localPath(string $source): ?string
    {
        $prefix = Storage::disk('public')->url('');

        if (str_starts_with($source, $prefix)) {
            return ltrim(substr($source, strlen($prefix)), '/');
        }

        if (! preg_match('#^https?://#i', $source) && ! str_starts_with($source, '/')) {
            return $source;
        }

        if (preg_match('#/storage/(.+)$#', $source, $match) && str_contains($source, parse_url((string) config('app.url'), PHP_URL_HOST) ?: '@@')) {
            return $match[1];
        }

        return null;
    }
}
