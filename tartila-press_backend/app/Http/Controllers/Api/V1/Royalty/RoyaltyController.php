<?php

namespace App\Http\Controllers\Api\V1\Royalty;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookExternalSale;
use App\Services\BookRoyaltyService;
use App\Services\Reader\ReaderRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoyaltyController extends Controller
{
    public function __construct(
        private readonly BookRoyaltyService $service,
        private readonly ReaderRoyaltyService $readerRoyalty,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Mine - Royalti user yang login: semua buku terbit di mana dia penulis
    | (25% dibagi jumlah bab, sesuai bab yang ditulis) atau editor proyek Book Chapter (5%)
    |--------------------------------------------------------------------------
    | Hanya menampilkan angka buku terjual yang sudah selesai (completed) —
    | data pesanan mentah (termasuk yang belum selesai) tetap admin-only.
    */

    public function mine(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $relations = [...BookRoyaltyService::SHARE_RELATIONS, 'externalSales', 'orderItems.order.voucher'];

        // Buku terbit (aktif) yang ditulis user, ditambah proyek Book Chapter
        // yang dipegangnya sebagai editor.
        $books = Book::with($relations)->publishedByAuthor($userId)->get()
            ->merge(
                Book::with($relations)
                    ->where('is_active', true)
                    ->where('owner_editor_id', $userId)
                    ->get()
            )
            ->unique('id')
            ->sortByDesc('created_at');

        $data = collect();
        $reader = $this->readerRoyalty->forBooks($books);

        foreach ($books as $book) {
            $readerCounted = false;

            foreach ($this->service->shares($book) as $share) {
                if ($share['user_id'] !== $userId) {
                    continue;
                }

                $rate = $share['rate'];
                $ebookRate = $share['ebook_rate'] ?? $rate;
                $summary = $this->service->summarize($book, $rate, $userId, $ebookRate);

                // Sumber ketiga: ebook di Tartila Book (pembelian + bacaan), bagian user ini.
                $mine = $readerCounted ? null : collect($reader[$book->id]['authors'] ?? [])->firstWhere('user_id', $userId);
                $readerCounted = $readerCounted || $mine !== null;
                $weight = (float) ($mine['weight'] ?? 0);
                $readerPurchase = round(($reader[$book->id]['purchase_royalty'] ?? 0) * $weight, 2);
                $readerRead = round(($reader[$book->id]['read_royalty'] ?? 0) * $weight, 2);
                $readerAmount = round($readerPurchase + $readerRead, 2);

                $data->push([
                    'id' => $book->id,
                    'title' => $book->title,
                    'price' => $book->price,
                    'role' => $share['role'],
                    'package' => $this->service->package($book),
                    'package_label' => BookRoyaltyService::PACKAGE_LABELS[$this->service->package($book)],
                    'authors_count' => $this->service->authors($book)->count(),
                    'chapters_count' => $share['chapters'] ?? null,
                    'total_chapters' => $share['total_chapters'] ?? null,
                    'royalty_percentage' => $rate,
                    'ebook_royalty_percentage' => $ebookRate,
                    'mou_id' => $share['mou_id'] ?? null,
                    'quantity_sold' => $summary['completed_quantity'],
                    'voucher_deduction' => $summary['voucher_deduction'],
                    'royalty_amount' => $summary['system_royalty_amount'],
                    'external_quantity_sold' => $summary['external_quantity'],
                    'external_royalty_amount' => $summary['external_royalty_amount'],
                    'total_quantity_sold' => $summary['total_quantity_sold'],
                    'reader_orders' => (int) ($reader[$book->id]['orders'] ?? 0),
                    'reader_read_events' => (int) ($reader[$book->id]['read_events'] ?? 0),
                    'reader_share_percent' => round($weight * 100, 2),
                    'reader_purchase_royalty' => $readerPurchase,
                    'reader_read_royalty' => $readerRead,
                    'reader_royalty_amount' => $readerAmount,
                    'total_royalty_amount' => round($summary['total_royalty_amount'] + $readerAmount, 2),
                    'external_sales' => $book->externalSales->map(fn (BookExternalSale $sale) => [
                        'id' => $sale->id,
                        'marketplace_name' => $sale->marketplace_name,
                        'format' => $sale->format,
                        'original_price' => $sale->original_price,
                        'quantity_sold' => $sale->quantity_sold,
                        'royalty_amount' => round(
                            (float) $sale->original_price * ($sale->format === 'ebook' ? $ebookRate : $rate) / 100 * $sale->quantity_sold,
                            2
                        ),
                    ])->values(),
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Royalti buku Anda berhasil diambil.',
            'data' => $data->values(),
        ]);
    }
}
