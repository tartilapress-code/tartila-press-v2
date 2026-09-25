<?php

namespace App\Http\Controllers\Api\V1\Royalty;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookExternalSale;
use App\Services\BookRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoyaltyController extends Controller
{
    public function __construct(private readonly BookRoyaltyService $service) {}

    /*
    |--------------------------------------------------------------------------
    | Mine - Royalti buku milik penulis yang login
    |--------------------------------------------------------------------------
    | Hanya menampilkan angka buku terjual yang sudah selesai (completed) —
    | data pesanan mentah (termasuk yang belum selesai) tetap admin-only.
    */

    public function mine(Request $request): JsonResponse
    {
        $books = Book::with(['externalSales', 'orderItems.order'])
            ->whereNotNull('royalty_percentage')
            ->whereHas('manuscript', fn ($query) => $query->where('user_id', $request->user()->id))
            ->latest()
            ->get();

        $data = $books->map(function (Book $book) {
            $summary = $this->service->summarize($book);

            return [
                'id' => $book->id,
                'title' => $book->title,
                'price' => $book->price,
                'royalty_percentage' => $book->royalty_percentage,
                'quantity_sold' => $summary['completed_quantity'],
                'royalty_amount' => $summary['system_royalty_amount'],
                'external_quantity_sold' => $summary['external_quantity'],
                'external_royalty_amount' => $summary['external_royalty_amount'],
                'total_quantity_sold' => $summary['total_quantity_sold'],
                'total_royalty_amount' => $summary['total_royalty_amount'],
                'external_sales' => $book->externalSales->map(fn (BookExternalSale $sale) => [
                    'id' => $sale->id,
                    'marketplace_name' => $sale->marketplace_name,
                    'original_price' => $sale->original_price,
                    'quantity_sold' => $sale->quantity_sold,
                    'royalty_amount' => round(
                        (float) $sale->original_price * (float) $book->royalty_percentage / 100 * $sale->quantity_sold,
                        2
                    ),
                ])->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'Royalti buku Anda berhasil diambil.',
            'data' => $data,
        ]);
    }
}
