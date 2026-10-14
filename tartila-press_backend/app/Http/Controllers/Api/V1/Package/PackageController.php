<?php

namespace App\Http\Controllers\Api\V1\Package;

use App\Http\Controllers\Controller;
use App\Models\Package;
use App\Support\IsbnTypes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Katalog paket publik
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $packages = Package::where('is_active', true)
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar paket berhasil diambil.',
            'data' => $packages,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show - Detail paket publik
    |--------------------------------------------------------------------------
    */

    public function show(Package $package): JsonResponse
    {
        abort_unless(
            $package->is_active,
            404,
            'Paket tidak ditemukan.'
        );

        return response()->json([
            'success' => true,
            'message' => 'Detail paket berhasil diambil.',
            'data' => $package,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Index - Semua paket termasuk yang nonaktif
    |--------------------------------------------------------------------------
    */

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar paket berhasil diambil.',
            'data' => Package::latest()->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin membuat paket
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePackage($request);
        $validated = $this->normalizeIsbnPrices($validated);

        $package = Package::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Paket berhasil dibuat.',
            'data' => $package,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah paket
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Package $package): JsonResponse
    {
        $validated = $this->validatePackage($request, sometimes: true);
        $validated = $this->normalizeIsbnPrices($validated, $package);

        $package->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Paket berhasil diperbarui.',
            'data' => $package,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus paket
    |--------------------------------------------------------------------------
    */

    public function destroy(Package $package): JsonResponse
    {
        $package->delete();

        return response()->json([
            'success' => true,
            'message' => 'Paket berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Validation Rules
    |--------------------------------------------------------------------------
    */

    /**
     * Harga per jenis ISBN: admin wajib memilih minimal satu jenis. Permintaan lama yang hanya
     * mengirim `price` dianggap harga ISBN cetak (jenis lain tetap).
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function normalizeIsbnPrices(array $validated, ?Package $package = null): array
    {
        if (array_key_exists('isbn_prices', $validated) && $validated['isbn_prices'] !== null) {
            $prices = collect($validated['isbn_prices'])
                ->filter(fn ($value, $type) => in_array($type, IsbnTypes::ALL, true) && $value !== null && $value !== '')
                ->all();

            abort_if($prices === [], 422, 'Pilih minimal satu jenis ISBN (cetak, digital, atau keduanya) beserta harganya.');

            $validated['isbn_prices'] = $prices;

            return $validated;
        }

        unset($validated['isbn_prices']);

        if ($package && array_key_exists('price', $validated)) {
            $validated['isbn_prices'] = [...($package->isbn_prices ?? []), IsbnTypes::PRINT => $validated['price']];
        }

        return $validated;
    }

    private function validatePackage(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes
            ? ['sometimes', ...$rules]
            : $rules;

        return $request->validate([
            'name' => $rule(['required', 'string', 'max:255']),
            'photo' => ['nullable', 'string', 'max:500'],
            'category' => ['nullable', 'string', 'max:255'],
            'price' => $sometimes
                ? ['sometimes', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT]
                : ['required_without:isbn_prices', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            // Harga per jenis ISBN yang ditawarkan: print (cetak), electronic (digital), both (keduanya).
            'isbn_prices' => ['nullable', 'array'],
            'isbn_prices.print' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'isbn_prices.electronic' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'isbn_prices.both' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            'description' => ['nullable', 'string'],
            'terms' => ['nullable', 'array'],
            'terms.*' => ['string'],
            'facilities' => ['nullable', 'array'],
            'facilities.*' => ['string'],
            'services' => ['nullable', 'array'],
            'services.*' => ['string'],
            'notes' => ['nullable', 'array'],
            'notes.*' => ['string'],
            'is_active' => ['nullable', 'boolean'],
            // Eksemplar buku gratis untuk pemesan (biaya cetak 3 + N).
            'free_copies' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ]);
    }
}
