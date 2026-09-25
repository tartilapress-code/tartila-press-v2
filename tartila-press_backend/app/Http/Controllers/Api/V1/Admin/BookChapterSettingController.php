<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\BookChapterSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookChapterSettingController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Show - Batas minimum/maksimum untuk proyek Book Chapter buatan editor
    |--------------------------------------------------------------------------
    */

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pengaturan Book Chapter berhasil diambil.',
            'data' => BookChapterSetting::current(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    public function update(Request $request): JsonResponse
    {
        $costLabels = [
            'hki_cost' => 'Biaya HKI',
            'isbn_print_cost' => 'Biaya ISBN cetak',
            'isbn_electronic_cost' => 'Biaya e-ISBN',
            'min_book_cost' => 'Minimal biaya 1 buku',
        ];

        $costMessages = [];
        foreach ($costLabels as $field => $label) {
            $costMessages["{$field}.numeric"] = "{$label} harus berupa angka.";
            $costMessages["{$field}.min"] = "{$label} tidak boleh kurang dari 0.";
            $costMessages["{$field}.max"] = "{$label} terlalu besar.";
        }

        $validated = $request->validate([
            'min_chapters' => ['required', 'integer', 'min:1'],
            'max_chapters' => ['nullable', 'integer', 'gte:min_chapters'],
            'min_price' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'max_discount' => ['required', 'integer', 'min:0', 'max:100'],
            'hki_cost' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'isbn_print_cost' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'isbn_electronic_cost' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'min_book_cost' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        ], $costMessages);

        // Dikosongkan = 0 (kolomnya NOT NULL).
        foreach (array_keys($costLabels) as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] === null) {
                $validated[$field] = 0;
            }
        }

        $settings = BookChapterSetting::current();
        $settings->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan Book Chapter berhasil diperbarui.',
            'data' => $settings->fresh(),
        ]);
    }
}
