<?php

namespace App\Http\Controllers\Api\V1\Package;

use App\Http\Controllers\Controller;
use App\Models\CustomPackageItem;
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
        $validated = $this->validatePackage($request, sometimes: true, package: $package);
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

    /**
     * Fasilitas/layanan paket HARUS berupa nama item di menu Item Custom (jenis yang sesuai),
     * supaya admin tidak mengetik ulang daftar yang sama. Nilai lama yang sudah tersimpan di
     * paket ini tetap boleh (paket lama dengan teks bebas tidak gagal disimpan; admin
     * membersihkannya sendiri). Yang disimpan tetap nama (teks), sehingga deteksi HKI/ISBN,
     * MOU, dan tampilan paket yang membaca teks itu tidak berubah.
     *
     * @param  list<string>|null  $current
     */
    private function itemNameRule(string $type, ?array $current): \Closure
    {
        $allowed = CustomPackageItem::where('type', $type)->pluck('name')->all();
        $allowed = array_merge($allowed, array_map('strval', $current ?? []));
        $label = $type === 'facility' ? 'fasilitas' : 'layanan';

        return function (string $attribute, mixed $value, \Closure $fail) use ($allowed, $label) {
            if (! in_array($value, $allowed, true)) {
                $fail("\"{$value}\" belum ada di menu Item Custom (jenis {$label}). Tambahkan dulu di sana, lalu pilih di paket.");
            }
        };
    }

    private function validatePackage(Request $request, bool $sometimes = false, ?Package $package = null): array
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
            'facilities.*' => ['string', $this->itemNameRule('facility', $package?->facilities)],
            'services' => ['nullable', 'array'],
            'services.*' => ['string', $this->itemNameRule('service', $package?->services)],
            'notes' => ['nullable', 'array'],
            'notes.*' => ['string'],
            'is_active' => ['nullable', 'boolean'],
            // Eksemplar buku gratis untuk pemesan (biaya cetak 3 + N).
            'free_copies' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ]);
    }
}
