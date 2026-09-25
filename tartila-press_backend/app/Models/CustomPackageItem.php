<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class CustomPackageItem extends Model
{
    protected $fillable = [
        'type',
        'name',
        'price',
        'discount',
        'book_chapter_cost',
        'description',
        'is_active',
    ];

    protected $appends = [
        'final_price',
    ];

    // Sama dengan default kolom, supaya item yang baru dibuat langsung
    // memuat discount = 0 (bukan null) di respons.
    protected $attributes = [
        'discount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'discount' => 'integer',
            'book_chapter_cost' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Potongan harga (Rp) dari diskon persen item ini. Rumus yang sama
     * dipakai untuk tampilan (final_price) dan penghitungan total order.
     */
    public function discountAmount(): float
    {
        return round($this->price * $this->discount / 100, 2);
    }

    protected function finalPrice(): Attribute
    {
        return Attribute::make(
            get: fn () => round($this->price - $this->discountAmount(), 2),
        );
    }
}
