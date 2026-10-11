<?php

namespace App\Support;

use App\Models\AboutProfile;
use App\Models\Order;
use App\Models\OrderItem;

/**
 * Data invoice sebuah pesanan: penerbit, pembeli, nomor & tanggal invoice,
 * item yang dibeli, rincian harga, rekening tujuan transfer, batas bayar
 * (1×24 jam) dan status pembayaran.
 */
class InvoicePresenter
{
    /** @return array<string, mixed> */
    public static function present(Order $order): array
    {
        $order->loadMissing(['user.personalProfile', 'items', 'editor', 'paymentMethod', 'bookShipment', 'statusHistories']);
        $about = AboutProfile::query()->first();

        $paidAt = $order->statusHistories->where('event', 'payment_confirmed')->min('created_at');
        $cancelled = $order->statusHistories->where('event', 'order_cancelled')->sortByDesc('id')->first();

        return [
            'id' => $order->id,
            'invoice_number' => $order->invoice_number ?? Order::invoiceNumberFor($order),
            'order_number' => $order->order_number,
            'issued_at' => $order->created_at,
            'payment_due_at' => $order->payment_due_at,
            'payment_window_hours' => Order::PAYMENT_WINDOW_HOURS,
            'status' => $order->status,
            'payment_status' => match (true) {
                in_array($order->status, ['confirmed', 'completed'], true) => 'paid',
                $order->status === 'cancelled' => 'cancelled',
                (bool) $order->payment_proof_file => 'awaiting_verification',
                default => 'unpaid',
            },
            'payment_proof_uploaded_at' => $order->payment_proof_uploaded_at,
            'paid_at' => $paidAt,
            'cancel_reason' => $order->status === 'cancelled' ? $cancelled?->note : null,
            'seller' => [
                'name' => 'Tartila Press',
                'address' => $about?->address,
                'email' => $about?->contact_email,
                'phone' => $about?->phone,
            ],
            'buyer' => [
                'name' => $order->user?->name,
                'email' => $order->user?->email,
                'phone' => $order->user?->personalProfile?->phone,
            ],
            'items' => $order->items->map(fn (OrderItem $item) => [
                'name' => $item->name,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'discount' => (float) $item->discount,
                'subtotal' => (float) $item->subtotal,
            ])->values(),
            'subtotal' => (float) $order->subtotal,
            'discount_total' => (float) $order->discount_total,
            'voucher_code' => $order->voucher_code,
            'voucher_discount' => (float) $order->voucher_discount,
            'editor' => $order->editor_id ? [
                'name' => $order->editor?->name,
                'fee' => (float) $order->editor_fee,
            ] : null,
            'total' => (float) $order->total,
            'payment_method' => $order->paymentMethod ? [
                'bank_name' => $order->paymentMethod->bank_name,
                'account_number' => $order->paymentMethod->account_number,
                'account_holder_name' => $order->paymentMethod->account_holder_name,
            ] : null,
            'shipment' => $order->bookShipment ? [
                'recipient_name' => $order->bookShipment->recipient_name,
                'recipient_phone' => $order->bookShipment->recipient_phone,
                'recipient_address' => $order->bookShipment->recipient_address,
            ] : null,
            'notes' => $order->notes,
        ];
    }
}
