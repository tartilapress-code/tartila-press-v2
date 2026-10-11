<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Transaksi masuk/keluar yang dicatat manual oleh admin. */
class FinanceTransaction extends Model
{
    public const CATEGORIES = [
        'other_income' => 'Pemasukan Lain',
        'printing' => 'Biaya Cetak',
        'operational' => 'Operasional',
        'honorarium' => 'Honor / Fee',
        'marketing' => 'Promosi',
        'tax' => 'Pajak',
        'transfer' => 'Pindah Rekening',
        'other_expense' => 'Pengeluaran Lain',
    ];

    protected $fillable = [
        'transaction_date',
        'direction',
        'category',
        'payment_method_id',
        'amount',
        'status',
        'description',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'float',
        ];
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
