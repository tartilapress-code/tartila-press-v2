<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Support\IsbnTypes;
use Illuminate\Validation\Rule;

/**
 * Aturan validasi opsi paket proyek Book Chapter (HKI, ISBN, dan
 * fasilitas/layanan yang dicentang) — dipakai controller admin & editor.
 */
trait HasBookChapterOptionRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    protected function bookChapterOptionRules(bool $creating = false): array
    {
        return [
            // Jenis ISBN proyek: cetak / digital / keduanya (menentukan biaya minimal, MOU, royalti).
            // Saat membuat proyek wajib dipilih (kecuali permintaan lama yang memakai centang includes_isbn_*).
            'isbn_type' => $creating
                ? ['required_without_all:includes_isbn_print,includes_isbn_electronic', 'nullable', Rule::in(IsbnTypes::ALL)]
                : ['sometimes', 'nullable', Rule::in(IsbnTypes::ALL)],
            'includes_hki' => ['sometimes', 'boolean'],
            'includes_isbn_print' => ['sometimes', 'boolean'],
            'includes_isbn_electronic' => ['sometimes', 'boolean'],
            'package_item_ids' => ['sometimes', 'array'],
            'package_item_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('custom_package_items', 'id')->where('is_active', true),
            ],
        ];
    }

    /**
     * Samakan jenis ISBN dengan centang cetak/elektronik: jenis dipilih -> centang mengikuti;
     * hanya centang (permintaan lama) -> jenis diturunkan dari centang.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function normalizeIsbnType(array $validated): array
    {
        if (! empty($validated['isbn_type'])) {
            $flags = IsbnTypes::flags($validated['isbn_type']);
            $validated['includes_isbn_print'] = $flags['print'];
            $validated['includes_isbn_electronic'] = $flags['electronic'];
        } elseif (array_key_exists('includes_isbn_print', $validated) || array_key_exists('includes_isbn_electronic', $validated)) {
            $validated['isbn_type'] = IsbnTypes::fromFlags(
                ! empty($validated['includes_isbn_print']),
                ! empty($validated['includes_isbn_electronic'])
            );
        }

        return $validated;
    }
}
