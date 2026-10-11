<?php

namespace App\Services;

use App\Models\BookChapter;
use App\Models\Order;

/**
 * Perubahan status pesanan beserta efek sampingnya (slot bab, pengiriman,
 * pendaftaran event, riwayat & notifikasi). Dipakai admin (ubah status,
 * verifikasi pembayaran) dan pembatalan otomatis pesanan yang tidak dibayar.
 */
class OrderStatusService
{
    public const AUTO_CANCEL_NOTE = 'Dibatalkan otomatis: belum ada konfirmasi pembayaran (bukti transfer) dalam 1×24 jam.';

    /** @param  string|null  $note  alasan pembatalan (bawaan: catatan verifikasi admin) */
    public function apply(Order $order, string $status, ?string $note = null): void
    {
        $order->update(['status' => $status]);

        if ($status === 'cancelled') {
            BookChapter::where('order_id', $order->id)
                ->whereNull('manuscript_id')
                ->update(['order_id' => null]);

            $order->bookShipment?->update(['status' => 'cancelled']);

            $order->eventRegistration?->update(['status' => 'cancelled']);

            $order->logStatusHistory('order_cancelled', $note ?? $order->payment_verification_note);
        }

        // Langsung "selesai" tanpa lewat "dikonfirmasi" tetap mencatat waktu lunas
        // (dipakai laporan keuangan).
        if ($status === 'confirmed'
            || ($status === 'completed' && ! $order->statusHistories()->where('event', 'payment_confirmed')->exists())) {
            $order->logStatusHistory('payment_confirmed');
        }

        if ($status === 'confirmed' && $order->bookShipment?->status === 'pending') {
            $order->bookShipment->update(['status' => 'confirmed']);
        }

        if ($status === 'confirmed' && $order->eventRegistration?->status === 'pending') {
            $order->eventRegistration->update(['status' => 'confirmed']);
        }

        if ($status === 'completed' && ! $order->bookShipment) {
            $order->logStatusHistory('order_completed');
        }

        if ($status === 'completed'
            && $order->bookShipment
            && $order->bookShipment->status !== 'delivered') {
            $order->bookShipment->markDelivered('admin');
        }
    }

    /**
     * Batalkan pesanan yang lewat batas bayar tanpa bukti transfer.
     *
     * @return int jumlah pesanan yang dibatalkan
     */
    public function cancelOverdue(): int
    {
        $cancelled = 0;

        Order::where('status', 'pending')
            ->whereNull('payment_proof_file')
            ->whereNotNull('payment_due_at')
            ->where('payment_due_at', '<=', now())
            ->orderBy('id')
            ->each(function (Order $order) use (&$cancelled) {
                $this->apply($order, 'cancelled', self::AUTO_CANCEL_NOTE);
                $cancelled++;
            });

        return $cancelled;
    }
}
