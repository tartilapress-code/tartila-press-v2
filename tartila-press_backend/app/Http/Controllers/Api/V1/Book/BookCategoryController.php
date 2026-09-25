<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\BookCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookCategoryController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar Kategori Buku publik (untuk dropdown filter)
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar kategori buku berhasil diambil.',
            'data' => BookCategory::orderBy('name')->get(),
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
            'name' => ['required', 'string', 'max:255', 'unique:book_categories,name'],
        ]);

        $category = BookCategory::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori buku berhasil ditambahkan.',
            'data' => $category,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah kategori
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, BookCategory $bookCategory): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:book_categories,name,'.$bookCategory->id,
            ],
        ]);

        $bookCategory->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori buku berhasil diperbarui.',
            'data' => $bookCategory,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus kategori
    |--------------------------------------------------------------------------
    */

    public function destroy(BookCategory $bookCategory): JsonResponse
    {
        $bookCategory->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kategori buku berhasil dihapus.',
        ]);
    }
}
