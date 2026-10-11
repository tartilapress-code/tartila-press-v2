<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Daftar per halaman: ?page=N&per_page=M (dibatasi). Respons tetap
 * { success, message, data: [...] } ditambah
 * meta: { current_page, last_page, per_page, total }.
 */
trait PaginatesResults
{
    protected function perPage(Request $request, int $default = 20, int $max = 100): int
    {
        return max(1, min($max, (int) $request->query('per_page', (string) $default)));
    }

    /**
     * Daftar hasil hitungan di memori (bukan query) dipotong per halaman.
     *
     * @param  Collection<int, mixed>  $items
     */
    protected function paginateCollection(Collection $items, Request $request, int $default = 20): LengthAwarePaginator
    {
        $perPage = $this->perPage($request, $default);
        $page = max(1, (int) $request->query('page', '1'));

        return new LengthAwarePaginator($items->forPage($page, $perPage)->values(), $items->count(), $perPage, $page);
    }

    /**
     * @param  callable|null  $map  bentuk tiap baris untuk respons
     * @param  array<string, mixed>  $meta  data tambahan di meta (mis. jumlah per status)
     */
    protected function pageResponse(LengthAwarePaginator $page, string $message, ?callable $map = null, array $meta = []): JsonResponse
    {
        $items = collect($page->items());

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => ($map ? $items->map($map) : $items)->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                ...$meta,
            ],
        ]);
    }
}
