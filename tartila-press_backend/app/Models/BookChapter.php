<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class BookChapter extends Model
{
    protected $fillable = [
        'book_id',
        'manuscript_id',
        'order_id',
        'chapter_number',
        'title',
        'price',
        'discount',
        'sop_terms',
        'preview_file',
    ];

    protected $appends = [
        'preview_url',
        'effective_price',
        'effective_discount',
        'final_price',
        'slot_status',
    ];

    protected function casts(): array
    {
        return [
            'chapter_number' => 'integer',
            'price' => 'decimal:2',
            'discount' => 'integer',
        ];
    }

    protected function previewUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->preview_file
                ? Storage::disk('public')->url($this->preview_file)
                : null,
        );
    }

    protected function effectivePrice(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->price ?? $this->book?->price,
        );
    }

    protected function effectiveDiscount(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->discount ?? $this->book?->discount ?? 0,
        );
    }

    protected function finalPrice(): Attribute
    {
        return Attribute::make(
            get: function () {
                $price = (float) $this->effective_price;
                $discount = (int) $this->effective_discount;

                return round($price - ($price * $discount / 100), 2);
            },
        );
    }

    protected function slotStatus(): Attribute
    {
        return Attribute::make(
            get: function () {
                if ($this->manuscript_id) {
                    return $this->manuscript?->status === 'completed'
                        ? 'completed'
                        : 'submitted';
                }

                return $this->order_id ? 'reserved' : 'open';
            },
        );
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
