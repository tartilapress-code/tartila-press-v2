<?php

namespace App\Http\Controllers\Api\V1\Package;

use App\Http\Controllers\Controller;
use App\Models\Package;
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

    private function validatePackage(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes
            ? ['sometimes', ...$rules]
            : $rules;

        return $request->validate([
            'name' => $rule(['required', 'string', 'max:255']),
            'photo' => ['nullable', 'string', 'max:500'],
            'category' => ['nullable', 'string', 'max:255'],
            'price' => $rule(['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT]),
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
        ]);
    }
}
