<?php

namespace App\Http\Controllers\Api\V1\Concerns;

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
    protected function bookChapterOptionRules(): array
    {
        return [
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
}
