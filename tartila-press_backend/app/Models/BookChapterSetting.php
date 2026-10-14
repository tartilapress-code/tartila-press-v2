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
        'min_book_cost_print',
        'min_book_cost_electronic',
        'min_book_cost_both',
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
            'min_book_cost_print' => 'decimal:2',
            'min_book_cost_electronic' => 'decimal:2',
            'min_book_cost_both' => 'decimal:2',
        ];
    }

    /**
     * Biaya minimal 1 buku untuk jenis ISBN tertentu (print/electronic/both). Belum diisi (atau jenis
     * belum dipilih) = nilai umum min_book_cost.
     */
    public function minimumFor(?string $isbnType): float
    {
        $value = match ($isbnType) {
            'print' => $this->min_book_cost_print,
            'electronic' => $this->min_book_cost_electronic,
            'both' => $this->min_book_cost_both,
            default => null,
        };

        return (float) ($value ?? $this->min_book_cost);
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
