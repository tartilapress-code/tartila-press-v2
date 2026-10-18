<?php

namespace App\Http\Controllers\Api\V1\Package;

use App\Http\Controllers\Controller;
use App\Models\CustomPackageItem;
use App\Models\Package;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomPackageItemController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar item untuk rakit paket custom
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        // Biaya khusus Book Chapter adalah biaya internal: tidak untuk publik.
        $items = CustomPackageItem::where('is_active', true)
            ->orderBy('type')
            ->orderBy('name');

        // Rekomendasi (maksimal 3, dipin admin) paling atas.
        $recommendations = app(RecommendationService::class);
        $recommendations->pinFirst($items, 'service', 'custom_package_items.id');
        $items = $items->get()->makeHidden('book_chapter_cost');
        $recommendations->markRecommended($items, 'service');

        return response()->json([
            'success' => true,
            'message' => 'Daftar item berhasil diambil.',
            'data' => $items,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Index - Semua item termasuk yang nonaktif
    |--------------------------------------------------------------------------
    */

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar item berhasil diambil.',
            'data' => CustomPackageItem::orderBy('type')
                ->orderBy('name')
                ->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin menambah item master
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateItem($request);

        $item = CustomPackageItem::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil ditambahkan.',
            'data' => $item,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah item master
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, CustomPackageItem $customPackageItem): JsonResponse
    {
        $validated = $this->validateItem($request, sometimes: true);

        $oldName = $customPackageItem->name;
        $type = $customPackageItem->type;

        $customPackageItem->update($validated);

        // Paket menyimpan NAMA item; kalau namanya diganti di sini, paket ikut diganti
        // supaya daftar paket tidak tertinggal dengan nama lama.
        if ($customPackageItem->wasChanged('name')) {
            $this->renameInPackages($type, $oldName, $customPackageItem->name);
        }

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil diperbarui.',
            'data' => $customPackageItem,
        ]);
    }

    /** Mengganti nama item di fasilitas/layanan semua paket yang memuatnya. */
    private function renameInPackages(string $type, string $from, string $to): void
    {
        $column = $type === 'facility' ? 'facilities' : 'services';

        Package::query()->get()->each(function (Package $package) use ($column, $from, $to) {
            $list = (array) $package->{$column};

            if (in_array($from, $list, true)) {
                $package->update([$column => array_values(array_unique(array_map(
                    fn ($name) => $name === $from ? $to : $name,
                    $list
                )))]);
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus item master
    |--------------------------------------------------------------------------
    */

    public function destroy(CustomPackageItem $customPackageItem): JsonResponse
    {
        $customPackageItem->delete();

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Validation Rules
    |--------------------------------------------------------------------------
    */

    private function validateItem(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes
            ? ['sometimes', ...$rules]
            : $rules;

        $validated = $request->validate([
            'type' => $rule(['required', Rule::in(['facility', 'service'])]),
            'name' => $rule(['required', 'string', 'max:255']),
            'price' => $rule(['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT]),
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            // Biaya item ini di proyek Book Chapter; kosong = gratis.
            'book_chapter_cost' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            // Eksemplar buku gratis dari item ini (biaya cetak 3 + N).
            'free_copies' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ]);

        // Diskon dikosongkan = tanpa diskon (kolomnya NOT NULL).
        if (array_key_exists('discount', $validated) && $validated['discount'] === null) {
            $validated['discount'] = 0;
        }

        return $validated;
    }
}
