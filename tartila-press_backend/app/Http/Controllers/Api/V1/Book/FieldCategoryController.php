<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\FieldCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldCategoryController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar Kategori Keilmuan publik (untuk dropdown filter)
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar kategori keilmuan berhasil diambil.',
            'data' => FieldCategory::orderBy('name')->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin menambah kategori
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:field_categories,name'],
        ]);

        $category = FieldCategory::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori keilmuan berhasil ditambahkan.',
            'data' => $category,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah kategori
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, FieldCategory $fieldCategory): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:field_categories,name,'.$fieldCategory->id,
            ],
        ]);

        $fieldCategory->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori keilmuan berhasil diperbarui.',
            'data' => $fieldCategory,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus kategori
    |--------------------------------------------------------------------------
    */

    public function destroy(FieldCategory $fieldCategory): JsonResponse
    {
        $fieldCategory->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kategori keilmuan berhasil dihapus.',
        ]);
    }
}
