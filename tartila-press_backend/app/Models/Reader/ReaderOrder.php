<?php

namespace App\Models\Reader;

use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Pembelian buku satuan atau langganan di Tartila Book (transfer + bukti bayar). */
class ReaderOrder extends Model
{
    public const PAYMENT_WINDOW_HOURS = 24;

    public const AUTO_CANCEL_NOTE = 'Dibatalkan otomatis: belum ada bukti transfer dalam 1×24 jam.';

    protected $fillable = [
        'order_number',
        'user_id',
        'kind',
        'reader_book_id',
        'reader_plan_id',
        'title',
        'amount',
        'status',
        'payment_method_id',
        'payment_proof_file',
        'payment_proof_uploaded_at',
        'payment_due_at',
        'payment_verification_note',
        'confirmed_at',
    ];

    protected $hidden = ['payment_proof_file'];

    protected $appends = ['has_payment_proof'];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'payment_proof_uploaded_at' => 'datetime',
            'payment_due_at' => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function getHasPaymentProofAttribute(): bool
    {
        return filled($this->payment_proof_file);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function readerBook(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ReaderPlan::class, 'reader_plan_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function entitlement(): HasOne
    {
        return $this->hasOne(ReaderEntitlement::class);
    }

    public function isOverdue(): bool
    {
        return $this->status === 'pending'
            && $this->payment_proof_file === null
            && $this->payment_due_at !== null
            && $this->payment_due_at->isPast();
    }
}
