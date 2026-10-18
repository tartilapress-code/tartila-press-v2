<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: mem-pin maksimal 3 konten rekomendasi per menu (tampil paling atas di menu dan di beranda). */
class RecommendationController extends Controller
{
    public function __construct(private readonly RecommendationService $recommendations) {}

    /** Semua menu beserta konten yang sedang di-pin. */
    public function index(): JsonResponse
    {
        $sections = collect([...RecommendationService::SECTIONS, ...RecommendationService::EXTERNAL])
            ->map(fn (string $section) => [
                'section' => $section,
                'label' => $this->recommendations->label($section),
                'limit' => RecommendationService::LIMIT,
                // Editor dikelola lewat "Promosikan" di Kelola Editor.
                'managed_elsewhere' => in_array($section, RecommendationService::EXTERNAL, true),
                'items' => $this->recommendations->pinnedItems($section),
            ])
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Rekomendasi berhasil diambil.',
            'data' => $sections,
        ]);
    }

    /** Pilihan konten yang boleh di-pin pada sebuah menu (hanya yang tampil publik). */
    public function options(Request $request, string $section): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pilihan rekomendasi berhasil diambil.',
            'data' => $this->recommendations->options($section, $request->query('search')),
        ]);
    }

    /** Mengganti seluruh pin sebuah menu; urutan item_ids = posisi 1, 2, 3. */
    public function update(Request $request, string $section): JsonResponse
    {
        $validated = $request->validate([
            'item_ids' => ['present', 'array', 'max:'.RecommendationService::LIMIT],
            'item_ids.*' => ['integer', 'distinct'],
        ], [
            'item_ids.max' => 'Maksimal '.RecommendationService::LIMIT.' konten rekomendasi per menu.',
        ]);

        $this->recommendations->replace($section, $validated['item_ids']);

        return response()->json([
            'success' => true,
            'message' => 'Rekomendasi '.$this->recommendations->label($section).' disimpan.',
            'data' => $this->recommendations->pinnedItems($section),
        ]);
    }
}
