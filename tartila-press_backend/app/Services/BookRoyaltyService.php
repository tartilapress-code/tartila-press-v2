<?php

namespace App\Services;

use App\Models\Book;
use App\Models\OrderItem;

class BookRoyaltyService
{
    /**
     * Ringkas data royalti satu buku. Caller wajib eager-load
     * 'orderItems.order' dan 'externalSales' di $book sebelum memanggil ini
     * supaya tidak ada query tambahan per buku (penting saat admin index
     * memproses banyak buku sekaligus).
     */
    public function summarize(Book $book): array
    {
        $completedItems = $book->orderItems->filter(
            fn (OrderItem $item) => $item->order?->status === 'completed'
        );

        $completedQuantity = (int) $completedItems->sum('quantity');

        // Pakai unit_price yang tersimpan di tiap OrderItem (snapshot harga
        // saat order dibuat), bukan book->price saat ini — supaya royalti
        // transaksi yang sudah selesai tidak ikut berubah kalau harga buku
        // diubah admin belakangan.
        $systemRevenue = $completedItems->sum(
            fn (OrderItem $item) => (float) $item->unit_price * $item->quantity
        );

        $rate = (float) ($book->royalty_percentage ?? 0);
        $systemRoyaltyAmount = round($systemRevenue * $rate / 100, 2);

        $externalQuantity = (int) $book->externalSales->sum('quantity_sold');
        $externalRoyaltyAmount = round(
            $book->externalSales->sum(
                fn ($sale) => (float) $sale->original_price * $rate / 100 * $sale->quantity_sold
            ),
            2
        );

        return [
            'total_orders_count' => $book->orderItems->count(),
            'completed_orders_count' => $completedItems->count(),
            'completed_quantity' => $completedQuantity,
            'system_royalty_amount' => $systemRoyaltyAmount,
            'external_quantity' => $externalQuantity,
            'external_royalty_amount' => $externalRoyaltyAmount,
            'total_quantity_sold' => $completedQuantity + $externalQuantity,
            'total_royalty_amount' => round($systemRoyaltyAmount + $externalRoyaltyAmount, 2),
        ];
    }
}
