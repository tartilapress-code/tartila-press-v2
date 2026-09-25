<?php

namespace App\Support;

/**
 * Merapikan nama penulis untuk metadata sitasi (Google Scholar dan sejenisnya):
 * gelar akademik dan sapaan dibuang, dan nama yang sama hanya dihitung sekali.
 *
 * Daftar penulis di aplikasi ini sering memuat gelar sebagai entri sendiri
 * (mis. ["Rahima Tartila", "S.T"]) karena isian penulis dipecah di koma saat
 * diinput. Gelar seperti itu tidak boleh terbaca sebagai penulis kedua.
 */
final class AuthorNames
{
    /**
     * Sapaan/gelar di depan nama (huruf kecil, tanpa titik).
     */
    private const TITLES = [
        'dr', 'drs', 'dra', 'ir', 'prof', 'haji', 'h', 'hj', 'kh', 'ustadz', 'ustadzah',
    ];

    /**
     * Gelar di belakang nama (huruf kecil, tanpa titik/spasi). Gelar lain yang
     * berpola "S.Kom." tetap dikenali lewat pola titiknya.
     */
    private const DEGREES = [
        'st', 'mt', 'skom', 'mkom', 'spd', 'mpd', 'ssi', 'msi', 'msc', 'bsc', 'se', 'me',
        'mm', 'mba', 'sh', 'mh', 'llm', 'ssos', 'msos', 'sip', 'mip', 'sag', 'magama',
        'sfarm', 'apt', 'skep', 'ners', 'skm', 'mkm', 'mkes', 'mars', 'sstp', 'msn',
        'phd', 'md', 'meng', 'beng', 'ak', 'ca', 'cpa', 'cma', 'psi', 'mpsi', 'spsi',
        'sked', 'sarn', 'mkn', 'dr',
    ];

    /**
     * @param  array<int, mixed>  $entries  Daftar penulis; tiap entri boleh memuat
     *                                      beberapa nama atau gelar.
     * @return list<string>
     */
    public static function fromList(array $entries): array
    {
        $names = [];

        foreach ($entries as $entry) {
            if (! is_string($entry)) {
                continue;
            }

            foreach (self::split($entry) as $piece) {
                $name = self::clean($piece);

                if ($name !== '') {
                    $names[mb_strtolower($name)] ??= $name;
                }
            }
        }

        return array_values($names);
    }

    /**
     * @return list<string>
     */
    public static function fromText(?string $text): array
    {
        return $text === null ? [] : self::fromList([$text]);
    }

    /**
     * @return list<string>
     */
    private static function split(string $entry): array
    {
        return preg_split('/\s*(?:[,;&]|\bdan\b|\band\b)\s*/iu', $entry) ?: [];
    }

    private static function clean(string $piece): string
    {
        $tokens = preg_split('/\s+/u', trim($piece), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        // Sapaan di depan ("Dr. Ani", "Prof. Dr. Ir. Budi"); satu token saja
        // dibiarkan dulu agar ditangani aturan gelar di belakang.
        while (count($tokens) > 1 && self::isTitle($tokens[0])) {
            array_shift($tokens);
        }

        // Gelar di belakang ("Ani S.T.", "Budi M.Kom", atau entri "S.T" sendirian).
        while ($tokens !== [] && self::isDegree($tokens[count($tokens) - 1])) {
            array_pop($tokens);
        }

        return implode(' ', $tokens);
    }

    private static function isTitle(string $token): bool
    {
        $key = self::normalize($token);

        if (! in_array($key, self::TITLES, true)) {
            return false;
        }

        // Singkatan pendek ("H", "Hj", "KH") baru dianggap sapaan bila bertitik,
        // agar inisial nama tidak ikut terbuang.
        return strlen($key) > 2 || str_ends_with($token, '.');
    }

    private static function isDegree(string $token): bool
    {
        if (in_array(self::normalize($token), self::DEGREES, true)) {
            return true;
        }

        // Pola bertitik dengan minimal satu bagian >= 2 huruf ("M.Han", "Ph.D",
        // "S.Kom."). Inisial murni seperti "B.J." tidak ikut terbuang.
        if (! preg_match('/^(?:[A-Za-z]{1,7}\.){1,3}[A-Za-z]{1,7}\.?$/', $token)) {
            return false;
        }

        foreach (preg_split('/\./', $token, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $part) {
            if (strlen($part) >= 2) {
                return true;
            }
        }

        return false;
    }

    private static function normalize(string $token): string
    {
        return strtolower((string) preg_replace('/[^A-Za-z]/', '', $token));
    }
}
