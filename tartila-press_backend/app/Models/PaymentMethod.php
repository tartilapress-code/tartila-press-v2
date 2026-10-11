<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    protected $fillable = [
        'bank_name',
        'account_number',
        'account_holder_name',
        'is_active',
        'opening_balance',
    ];

    // Saldo rekening hanya untuk halaman Keuangan admin, bukan untuk pembeli.
    protected $hidden = [
        'opening_balance',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
