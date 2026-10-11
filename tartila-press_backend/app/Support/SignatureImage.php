<?php

namespace App\Support;

/**
 * Tanda tangan dari kanvas browser: data URL PNG 8-bit tanpa interlace
 * (format yang bisa dipasang tFPDF tanpa GD). Dipakai surat ISBN & MOU.
 */
final class SignatureImage
{
    /** @return string isi PNG; 422 bila bukan tanda tangan yang valid */
    public static function decode(string $dataUrl): string
    {
        abort_unless(preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $match), 422, 'Tanda tangan tidak valid.');

        $png = base64_decode($match[1], true);

        abort_if(
            $png === false
            || strlen($png) < 50
            || strlen($png) > 500_000
            || ! str_starts_with($png, "\x89PNG\r\n\x1a\n")
            || ord($png[24]) !== 8
            || ord($png[28]) !== 0,
            422,
            'Tanda tangan tidak valid. Gambar ulang tanda tangan Anda.'
        );

        return $png;
    }
}
