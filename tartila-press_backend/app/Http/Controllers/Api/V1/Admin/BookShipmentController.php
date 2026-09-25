<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\BookShipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookShipmentController extends Controller
{
    private const STATUSES = [
        'pending',
        'confirmed',
        'printing',
        'packing',
        'shipping',
        'awaiting_confirmation',
        'delivered',
        'cancelled',
    ];

    /*
    |--------------------------------------------------------------------------
    | Update - Admin menaikkan progres pengiriman & estimasi waktu sampai
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, BookShipment $bookShipment): JsonResponse
    {
        $bookShipment->load('order');

        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(self::STATUSES)],
            'estimated_arrival_date' => ['sometimes', 'nullable', 'date'],
        ]);

        abort_if(
            $bookShipment->status === 'cancelled',
            422,
            'Pesanan ini sudah dibatalkan.'
        );

        $newStatus = $validated['status'] ?? null;

        if ($newStatus && ! in_array($newStatus, ['pending', 'cancelled'], true)) {
            abort_if(
                $bookShipment->order->status !== 'confirmed',
                422,
                'Pesanan harus dikonfirmasi terlebih dahulu sebelum mengubah progres pengiriman.'
            );
        }

        if (array_key_exists('estimated_arrival_date', $validated)) {
            $bookShipment->update([
                'estimated_arrival_date' => $validated['estimated_arrival_date'],
            ]);
        }

        if ($newStatus === 'delivered') {
            $bookShipment->markDelivered('admin');
        } elseif ($newStatus === 'awaiting_confirmation') {
            $bookShipment->update([
                'status' => 'awaiting_confirmation',
                'awaiting_confirmation_at' => now(),
            ]);
            $bookShipment->order->logStatusHistory('shipment_'.$newStatus);
        } elseif ($newStatus) {
            $bookShipment->update(['status' => $newStatus]);
            $bookShipment->order->logStatusHistory('shipment_'.$newStatus);
        }

        return response()->json([
            'success' => true,
            'message' => 'Progres pengiriman berhasil diperbarui.',
            'data' => $bookShipment->fresh(),
        ]);
    }
}
