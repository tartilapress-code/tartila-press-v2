<?php

namespace App\Support;

/**
 * Jumlah halaman PDF tanpa pustaka PDF: membaca akar daftar halaman
 * ("/Type /Pages ... /Count N"). Hanya untuk PDF klasik; PDF yang daftar
 * halamannya dimampatkan (object stream) mengembalikan null. Unggahan dari
 * admin mengirim jumlah halaman terbaca peramban, ini cadangannya.
 */
class PdfPages
{
    public static function count(string $path): ?int
    {
        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            return null;
        }

        $best = null;
        $carry = '';

        while (! feof($handle)) {
            $chunk = $carry.fread($handle, 1024 * 1024);

            if (preg_match_all('~/Type\s*/Pages\b[^>]*?/Count\s+(\d+)|/Count\s+(\d+)[^>]*?/Type\s*/Pages\b~s', $chunk, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $best = max($best ?? 0, (int) ($match[1] !== '' ? $match[1] : $match[2]));
                }
            }

            // Sambungan antar-potongan supaya kamus yang terpotong tetap terbaca.
            $carry = substr($chunk, -1024);
        }

        fclose($handle);

        return $best !== null && $best > 0 ? $best : null;
    }
}
