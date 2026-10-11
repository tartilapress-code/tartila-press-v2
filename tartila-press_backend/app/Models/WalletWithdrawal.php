<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletWithdrawal extends Model
{
    /** Biaya admin per penarikan, dipotong dari jumlah yang diminta. */
    public const ADMIN_FEE = 5000;

    /** Jumlah minimum yang bisa diminta (harus melebihi biaya admin). */
    public const MIN_AMOUNT = 10000;

    protected $fillable = [
        'user_id',
        'amount',
        'admin_fee',
        'net_amount',
        'bank_name',
        'account_number',
        'account_name',
        'status',
        'admin_note',
        'processed_by',
        'processed_at',
        'payment_method_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'admin_fee' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'processed_at' => 'datetime',
        ];
    }

    /** Rekening sumber transfer penarikan. */
    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
