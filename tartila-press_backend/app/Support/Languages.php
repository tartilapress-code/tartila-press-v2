<?php

namespace App\Support;

use Illuminate\Validation\Rule;

/**
 * Bahasa yang bisa dipilih untuk buku, proyek Book Chapter (bahasa isi
 * bukunya), dan profil editor (bahasa yang dikuasai). Disimpan sebagai daftar
 * kode ISO 639 huruf kecil, misalnya ["id", "en"]; satu isian boleh memuat
 * lebih dari satu bahasa.
 *
 * Ini bukan bahasa tampilan situs. Nama tiap bahasa dirender di frontend
 * (`src/lib/contentLanguages.ts` + terjemahan `contentLanguages.names`),
 * jadi menambah bahasa berarti menambah kodenya di dua daftar itu.
 */
final class Languages
{
    /**
     * Urutan di sini menjadi urutan tampil (bahasa utama dulu).
     */
    public const CODES = [
        'id', 'en', 'ms', 'ar',
        'jv', 'su', 'min', 'ban',
        'zh', 'ja', 'ko', 'hi', 'th', 'vi', 'fa', 'tr',
        'de', 'fr', 'nl', 'es', 'pt', 'it', 'ru',
    ];

    /**
     * Aturan validasi untuk isian `languages` (opsional, boleh kosong).
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'languages' => ['nullable', 'array', 'max:'.count(self::CODES)],
            'languages.*' => ['string', Rule::in(self::CODES)],
        ];
    }

    /**
     * Rapikan daftar kode: kode tak dikenal dibuang, duplikat digabung, dan
     * urutannya mengikuti daftar CODES supaya tampilannya selalu konsisten.
     *
     * @return list<string>
     */
    public static function normalize(mixed $codes): array
    {
        if (! is_array($codes)) {
            return [];
        }

        $wanted = array_map(
            fn ($code) => is_string($code) ? strtolower(trim($code)) : '',
            $codes
        );

        return array_values(array_filter(
            self::CODES,
            fn (string $code) => in_array($code, $wanted, true)
        ));
    }

    /**
     * Baca daftar kode dari satu sel teks (impor CSV), dipisah ";", "|", atau
     * koma. Kode yang tidak dikenal ikut dikembalikan di `unknown` supaya
     * pemanggil bisa menolaknya.
     *
     * @return array{languages: list<string>, unknown: list<string>}
     */
    public static function parseDelimited(?string $value): array
    {
        $parts = preg_split('/[;|,]+/', (string) $value) ?: [];
        $parts = array_values(array_filter(array_map(
            fn (string $part) => strtolower(trim($part)),
            $parts
        ), fn (string $part) => $part !== ''));

        return [
            'languages' => self::normalize($parts),
            'unknown' => array_values(array_unique(array_diff($parts, self::CODES))),
        ];
    }
}
