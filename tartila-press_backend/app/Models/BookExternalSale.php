<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookExternalSale extends Model
{
    /** Jenis penjualan: royalti buku fisik atau royalti ebook (sesuai MOU). */
    public const FORMATS = ['physical', 'ebook'];

    protected $attributes = [
        'format' => 'physical',
    ];

    protected $fillable = [
        'book_id',
        'marketplace_name',
        'format',
        'original_price',
        'discount_percentage',
        'discounted_price',
        'quantity_sold',
    ];

    protected function casts(): array
    {
        return [
            'original_price' => 'decimal:2',
            'discount_percentage' => 'integer',
            'discounted_price' => 'decimal:2',
            'quantity_sold' => 'integer',
        ];
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }
}
