<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookShipment extends Model
{
    protected $fillable = [
        'order_id',
        'recipient_name',
        'recipient_phone',
        'recipient_address',
        'status',
        'estimated_arrival_date',
        'awaiting_confirmation_at',
        'delivered_at',
        'delivery_confirmed_by',
    ];

    protected function casts(): array
    {
        return [
            'estimated_arrival_date' => 'date',
            'awaiting_confirmation_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Satu jalur untuk menyelesaikan pengiriman, dipakai oleh admin,
     * konfirmasi user, dan command auto-confirm - supaya order induk selalu
     * ikut ditandai selesai tanpa duplikasi logika di 3 tempat.
     */
    public function markDelivered(string $confirmedBy): void
    {
        if ($this->order->status === 'cancelled' || $this->status === 'cancelled') {
            return;
        }

        $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'delivery_confirmed_by' => $confirmedBy,
        ]);

        $this->order->update(['status' => 'completed']);
        $this->order->logStatusHistory('order_completed');
    }
}
