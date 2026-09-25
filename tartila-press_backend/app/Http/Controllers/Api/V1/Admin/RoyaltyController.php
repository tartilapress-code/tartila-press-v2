<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookExternalSale;
use App\Services\BookRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoyaltyController extends Controller
{
    private const EXTERNAL_SALE_RULES = [
        'marketplace_name' => ['required', 'string', 'max:255'],
        'original_price' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'discount_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
        'discounted_price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'quantity_sold' => ['required', 'integer', 'min:0'],
    ];

    public function __construct(private readonly BookRoyaltyService $service) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua buku yang sudah diinput nilai royaltinya
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $books = Book::with(['manuscript.user', 'externalSales', 'orderItems.order'])
            ->whereNotNull('royalty_percentage')
            ->latest()
            ->get();

        $data = $books->map(function (Book $book) {
            $author = $book->manuscript?->user;

            return [
                'id' => $book->id,
                'title' => $book->title,
                'authors_text' => $book->authors_text,
                'author' => $author ? ['id' => $author->id, 'name' => $author->name] : null,
                'price' => $book->price,
                'royalty_percentage' => $book->royalty_percentage,
                'external_sales' => $book->externalSales->map(fn (BookExternalSale $sale) => [
                    'id' => $sale->id,
                    'marketplace_name' => $sale->marketplace_name,
                    'original_price' => $sale->original_price,
                    'discount_percentage' => $sale->discount_percentage,
                    'discounted_price' => $sale->discounted_price,
                    'quantity_sold' => $sale->quantity_sold,
                ])->values(),
                ...$this->service->summarize($book),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar royalti buku berhasil diambil.',
            'data' => $data,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | External Sales - Penjualan buku di luar sistem (dicatat manual admin)
    |--------------------------------------------------------------------------
    */

    public function storeExternalSale(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate(self::EXTERNAL_SALE_RULES);

        $sale = $book->externalSales()->create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil dicatat.',
            'data' => $sale,
        ], 201);
    }

    public function updateExternalSale(Request $request, BookExternalSale $bookExternalSale): JsonResponse
    {
        $rules = collect(self::EXTERNAL_SALE_RULES)
            ->map(fn (array $rules) => ['sometimes', ...$rules])
            ->toArray();

        $validated = $request->validate($rules);

        $bookExternalSale->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil diperbarui.',
            'data' => $bookExternalSale,
        ]);
    }

    public function destroyExternalSale(BookExternalSale $bookExternalSale): JsonResponse
    {
        $bookExternalSale->delete();

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil dihapus.',
        ]);
    }
}
