<?php

namespace App\Support;

/**
 * Jenis ISBN sebuah paket / proyek Book Chapter: cetak, digital (elektronik), atau keduanya.
 * Menentukan harga paket, biaya minimal Book Chapter, dan jenis royalti di MOU
 * (cetak = royalti buku fisik, digital = royalti ebook, keduanya = dua-duanya).
 * Teks penjelasan untuk pembeli ada di frontend (src/lib/isbnTypes.ts); kunci HARUS sama.
 */
final class IsbnTypes
{
    public const PRINT = 'print';

    public const ELECTRONIC = 'electronic';

    public const BOTH = 'both';

    public const ALL = [self::PRINT, self::ELECTRONIC, self::BOTH];

    public const LABELS = [
        self::PRINT => 'ISBN Cetak',
        self::ELECTRONIC => 'ISBN Digital',
        self::BOTH => 'ISBN Cetak + Digital',
    ];

    /** @return array{print: bool, electronic: bool} */
    public static function flags(?string $type): array
    {
        return [
            'print' => in_array($type, [self::PRINT, self::BOTH], true),
            'electronic' => in_array($type, [self::ELECTRONIC, self::BOTH], true),
        ];
    }

    public static function fromFlags(bool $print, bool $electronic): ?string
    {
        return match (true) {
            $print && $electronic => self::BOTH,
            $print => self::PRINT,
            $electronic => self::ELECTRONIC,
            default => null,
        };
    }

    public static function label(?string $type): ?string
    {
        return $type ? (self::LABELS[$type] ?? null) : null;
    }
}
