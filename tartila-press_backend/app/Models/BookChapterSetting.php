<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookChapterSetting extends Model
{
    protected $fillable = [
        'min_chapters',
        'max_chapters',
        'min_price',
        'max_discount',
        'hki_cost',
        'isbn_print_cost',
        'isbn_electronic_cost',
        'min_book_cost',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'min_chapters' => 'integer',
            'max_chapters' => 'integer',
            'min_price' => 'decimal:2',
            'max_discount' => 'integer',
            'hki_cost' => 'decimal:2',
            'isbn_print_cost' => 'decimal:2',
            'isbn_electronic_cost' => 'decimal:2',
            'min_book_cost' => 'decimal:2',
        ];
    }

    public static function current(): self
    {
        return static::query()->first() ?? static::create([
            'min_chapters' => 2,
            'min_price' => 0,
            'max_discount' => 100,
        ]);
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
