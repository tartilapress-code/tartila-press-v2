<?php

namespace App\Observers;

use App\Models\Order;
use App\Models\OrderMessage;
use App\Services\Notifier;
use Illuminate\Support\Str;

/** Pesan di pesanan: dari admin → pembeli, dari pembeli → admin. */
class OrderMessageObserver
{
    public bool $afterCommit = true;

    public function __construct(private readonly Notifier $notifier) {}

    public function created(OrderMessage $message): void
    {
        $this->notifier->guard(fn () => $this->handleCreated($message));
    }

    private function handleCreated(OrderMessage $message): void
    {
        $order = Order::with('user')->find($message->order_id);

        if (! $order) {
            return;
        }

        $subject = ['subject_type' => 'order', 'subject_id' => $order->id];
        $preview = Str::limit((string) $message->body, 140);

        if ($message->is_admin) {
            $this->notifier->notify($order->user, 'order', "Pesan baru dari admin · {$order->order_number}", $preview, '/dashboard/pesanan', $subject);

            return;
        }

        $this->notifier->notifyAdmins('admin_order', "Pesan baru dari pembeli · {$order->order_number}", $preview, '/admin/orders', $subject);
    }
}
