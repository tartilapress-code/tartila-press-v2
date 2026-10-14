<?php

namespace App\Models;

use App\Support\IsbnTypes;
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
        'isbn_prices',
        'discount',
        'description',
        'terms',
        'facilities',
        'services',
        'notes',
        'is_active',
        'created_by',
        'free_copies',
    ];

    protected $appends = [
        'final_price',
        'isbn_options',
        'default_isbn_type',
    ];

    protected static function booted(): void
    {
        // Harga per jenis ISBN: `price` selalu = harga bawaan yang tampil (ISBN cetak bila ditawarkan).
        static::saving(function (Package $package) {
            $prices = collect($package->isbn_prices ?? [])
                ->filter(fn ($value, $type) => in_array($type, IsbnTypes::ALL, true) && $value !== null && $value !== '')
                ->map(fn ($value) => round((float) $value, 2))
                ->all();

            if ($prices === []) {
                $prices = ['print' => round((float) $package->price, 2)];
            }

            $ordered = [];

            foreach (IsbnTypes::ALL as $type) {
                if (isset($prices[$type])) {
                    $ordered[$type] = $prices[$type];
                }
            }

            $package->isbn_prices = $ordered;
            $package->price = $ordered[IsbnTypes::PRINT] ?? reset($ordered);
        });
    }

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'isbn_prices' => 'array',
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

    /** Jenis ISBN yang ditawarkan paket ini beserta harganya (diskon paket berlaku untuk semuanya). */
    protected function isbnOptions(): Attribute
    {
        return Attribute::make(
            get: fn () => collect($this->isbn_prices ?? [])
                ->map(fn ($price, $type) => [
                    'type' => $type,
                    'label' => IsbnTypes::label($type),
                    'price' => round((float) $price, 2),
                    'final_price' => round((float) $price - ((float) $price * $this->discount / 100), 2),
                ])
                ->values()
                ->all(),
        );
    }

    protected function defaultIsbnType(): Attribute
    {
        return Attribute::make(get: fn () => array_key_first($this->isbn_prices ?? []) ?? IsbnTypes::PRINT);
    }

    /** Harga setelah diskon untuk satu jenis ISBN (null bila jenis itu tidak ditawarkan). */
    public function priceFor(?string $type): ?float
    {
        $prices = $this->isbn_prices ?? [];

        return isset($prices[$type]) ? round((float) $prices[$type], 2) : null;
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
