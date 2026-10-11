<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pengaturan perhitungan keuangan (satu baris). */
class FinanceSetting extends Model
{
    protected $fillable = [
        'admin_cover_cost',
        'print_cost_percent',
        'base_print_copies',
        'default_book_price',
        'hki_cost',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'admin_cover_cost' => 'float',
            'print_cost_percent' => 'float',
            'base_print_copies' => 'integer',
            'default_book_price' => 'float',
            'hki_cost' => 'float',
        ];
    }

    public static function current(): self
    {
        return static::query()->first() ?? static::create([]);
    }
}
