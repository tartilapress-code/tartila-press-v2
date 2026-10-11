<?php

namespace App\Support\Certificates;

use Illuminate\Validation\Rule;

/**
 * Bentuk satu kolom teks di sebuah templat sertifikat:
 *
 *   id        string  pengenal dari editor (tidak dipakai di PDF)
 *   text      string  isi teks, boleh memuat penanda {name}, {book_title}, dst.
 *   x, y      float   pojok kiri atas kotak, pecahan 0..1 dari lebar/tinggi halaman
 *   w, h      float   lebar/tinggi kotak, pecahan 0..1
 *   font      string  kunci font (config/certificates.php)
 *   bold      bool    huruf tebal (kalau font-nya punya)
 *   size      float   ukuran huruf dalam poin pada halaman berukuran
 *                     config('certificates.page_long_side_pt')
 *   color     string  #RRGGBB
 *   align     string  left | center | right
 *   valign    string  top | middle | bottom
 *   uppercase bool    ubah ke HURUF BESAR
 *   autoFit   bool    kecilkan huruf otomatis supaya muat di kotak
 */
final class TemplateFields
{
    public const MAX_FIELDS = 40;

    public const ALIGNS = ['left', 'center', 'right'];

    public const VALIGNS = ['top', 'middle', 'bottom'];

    /**
     * Aturan validasi untuk request yang membawa daftar kolom.
     *
     * @return array<string, mixed>
     */
    public static function rules(string $attribute = 'fields'): array
    {
        return [
            $attribute => ['required', 'array', 'max:'.self::MAX_FIELDS],
            "{$attribute}.*.id" => ['required', 'string', 'max:40'],
            "{$attribute}.*.text" => ['nullable', 'string', 'max:500'],
            "{$attribute}.*.x" => ['required', 'numeric', 'between:0,1'],
            "{$attribute}.*.y" => ['required', 'numeric', 'between:0,1'],
            "{$attribute}.*.w" => ['required', 'numeric', 'between:0.01,1'],
            "{$attribute}.*.h" => ['required', 'numeric', 'between:0.005,1'],
            "{$attribute}.*.font" => ['required', Rule::in(array_keys(CertificateFonts::all()))],
            "{$attribute}.*.bold" => ['sometimes', 'boolean'],
            "{$attribute}.*.size" => ['required', 'numeric', 'between:6,200'],
            "{$attribute}.*.color" => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            "{$attribute}.*.align" => ['required', Rule::in(self::ALIGNS)],
            "{$attribute}.*.valign" => ['required', Rule::in(self::VALIGNS)],
            "{$attribute}.*.uppercase" => ['sometimes', 'boolean'],
            "{$attribute}.*.autoFit" => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Membersihkan daftar kolom yang sudah lolos validasi: hanya kunci yang
     * dikenal, tipe data pasti, dan kotak tidak keluar dari halaman.
     *
     * @param  array<int, array<string, mixed>>  $fields
     * @return list<array<string, mixed>>
     */
    public static function normalize(array $fields): array
    {
        return array_values(array_map(function (array $field) {
            // Kotak selalu utuh di dalam halaman: ukurannya dibatasi dulu,
            // baru posisinya digeser kalau masih keluar.
            $w = self::clamp((float) $field['w'], 0.01, 1);
            $h = self::clamp((float) $field['h'], 0.005, 1);
            $x = self::clamp((float) $field['x'], 0, 1 - $w);
            $y = self::clamp((float) $field['y'], 0, 1 - $h);

            return [
                'id' => (string) $field['id'],
                'text' => (string) ($field['text'] ?? ''),
                'x' => round($x, 5),
                'y' => round($y, 5),
                'w' => round($w, 5),
                'h' => round($h, 5),
                'font' => (string) $field['font'],
                'bold' => (bool) ($field['bold'] ?? false),
                'size' => round((float) $field['size'], 2),
                'color' => strtolower((string) $field['color']),
                'align' => (string) $field['align'],
                'valign' => (string) $field['valign'],
                'uppercase' => (bool) ($field['uppercase'] ?? false),
                'autoFit' => (bool) ($field['autoFit'] ?? true),
            ];
        }, $fields));
    }

    private static function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
