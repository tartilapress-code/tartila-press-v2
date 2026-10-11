<?php

namespace App\Observers;

use App\Models\AboutProfile;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Services\Notifier;

/**
 * Setiap peristiwa pesanan dicatat di riwayat status; dari situ notifikasi
 * dikirim: pesanan baru & bukti transfer → admin (+ email kantor untuk
 * pesanan baru), konfirmasi/pembatalan/pengiriman/selesai → pembeli.
 */
class OrderStatusHistoryObserver
{
    public bool $afterCommit = true;

    private const SHIPMENT_LABELS = [
        'confirmed' => 'pesanan dikonfirmasi',
        'printing' => 'sedang dicetak',
        'packing' => 'sedang dikemas',
        'shipping' => 'sedang dikirim',
        'awaiting_confirmation' => 'sudah sampai, mohon konfirmasi penerimaan',
        'delivered' => 'buku sudah sampai',
        'cancelled' => 'pengiriman dibatalkan',
    ];

    public function __construct(private readonly Notifier $notifier) {}

    public function created(OrderStatusHistory $history): void
    {
        $this->notifier->guard(fn () => $this->handleCreated($history));
    }

    private function handleCreated(OrderStatusHistory $history): void
    {
        $order = Order::with(['user', 'items'])->find($history->order_id);

        if (! $order) {
            return;
        }

        $number = $order->order_number;
        $summary = self::summary($order);
        $total = self::rupiah((float) $order->total);
        $subject = ['subject_type' => 'order', 'subject_id' => $order->id];

        switch (true) {
            case $history->event === 'order_placed':
                $buyer = $order->user?->name ?? 'Pembeli';
                $this->notifier->notifyAdmins('admin_order', "Pesanan baru {$number}", "{$buyer} · {$summary} · {$total}", '/admin/orders', $subject);
                $this->notifier->emailAddress(
                    self::officeEmail(),
                    "Pesanan baru {$number}",
                    [
                        'Ada pesanan baru di Tartila Press.',
                        "Nomor pesanan: {$number}",
                        'Pemesan: '.$buyer.($order->user?->email ? " ({$order->user->email})" : ''),
                        'Item: '.$order->items->map(fn (OrderItem $item) => $item->name.($item->quantity > 1 ? " × {$item->quantity}" : ''))->implode(', '),
                        "Total: {$total}",
                        'Status: menunggu pembayaran dan verifikasi bukti transfer.',
                    ],
                    '/admin/orders'
                );
                break;

            case $history->event === 'payment_proof_uploaded':
                $this->notifier->notifyAdmins('admin_order', "Bukti transfer diunggah · {$number}", ($order->user?->name ?? 'Pembeli')." · {$total}", '/admin/orders', $subject);
                break;

            case $history->event === 'payment_confirmed':
                $this->notifier->notify($order->user, 'order', "Pembayaran pesanan {$number} dikonfirmasi", $summary, '/dashboard/pesanan', $subject);
                break;

            case $history->event === 'order_cancelled':
                $this->notifier->notify($order->user, 'order', "Pesanan {$number} dibatalkan", $history->note ?: $summary, '/dashboard/pesanan', $subject);
                break;

            case $history->event === 'order_completed':
                $this->notifier->notify($order->user, 'order', "Pesanan {$number} selesai", $summary, '/dashboard/pesanan', $subject);
                break;

            case str_starts_with($history->event, 'shipment_'):
                $label = self::SHIPMENT_LABELS[substr($history->event, 9)] ?? str_replace('_', ' ', substr($history->event, 9));
                $this->notifier->notify($order->user, 'order', "Pengiriman pesanan {$number}: {$label}", $summary, '/dashboard/pesanan', $subject);
                break;
        }
    }

    /** "Buku A, Paket B dan 2 item lainnya". */
    public static function summary(Order $order): string
    {
        $names = $order->items->pluck('name')->filter()->values();

        if ($names->isEmpty()) {
            return 'Pesanan';
        }

        $shown = $names->take(2)->implode(', ');

        return $names->count() > 2 ? $shown.' dan '.($names->count() - 2).' item lainnya' : $shown;
    }

    public static function rupiah(float $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /** ORDER_NOTIFICATION_EMAIL bila diisi; kalau tidak, email kontak di halaman Tentang Kami. */
    private static function officeEmail(): string
    {
        return (string) (config('app.order_notification_email')
            ?: AboutProfile::query()->value('contact_email'));
    }
}
