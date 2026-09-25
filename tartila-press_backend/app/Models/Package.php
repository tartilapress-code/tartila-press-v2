<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Package extends Model
{
    protected $fillable = [
        'name',
        'photo',
        'category',
        'price',
        'discount',
        'description',
        'terms',
        'facilities',
        'services',
        'notes',
        'is_active',
        'created_by',
    ];

    protected $appends = [
        'final_price',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'discount' => 'integer',
            'terms' => 'array',
            'facilities' => 'array',
            'services' => 'array',
            'notes' => 'array',
            'is_active' => 'boolean',
        ];
    }

    protected function finalPrice(): Attribute
    {
        return Attribute::make(
            get: fn () => round(
                $this->price - ($this->price * $this->discount / 100),
                2
            ),
        );
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
