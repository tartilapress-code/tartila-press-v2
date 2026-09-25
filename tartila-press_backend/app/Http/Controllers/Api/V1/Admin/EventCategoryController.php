<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EventCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar kategori event berhasil diambil.',
            'data' => EventCategory::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:event_categories,name'],
        ]);

        $category = EventCategory::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori event berhasil ditambahkan.',
            'data' => $category,
        ], 201);
    }

    public function update(Request $request, EventCategory $eventCategory): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:event_categories,name,'.$eventCategory->id,
            ],
        ]);

        $eventCategory->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kategori event berhasil diperbarui.',
            'data' => $eventCategory,
        ]);
    }

    public function destroy(EventCategory $eventCategory): JsonResponse
    {
        $eventCategory->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kategori event berhasil dihapus.',
        ]);
    }
}
