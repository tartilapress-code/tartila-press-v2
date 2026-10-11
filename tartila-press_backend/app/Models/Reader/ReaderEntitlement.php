<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Hak baca dari pembelian satu buku atau langganan. */
class ReaderEntitlement extends Model
{
    protected $fillable = [
        'user_id',
        'kind',
        'reader_book_id',
        'reader_plan_id',
        'reader_order_id',
        'starts_at',
        'ends_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ReaderPlan::class, 'reader_plan_id');
    }

    public function readerBook(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class);
    }

    /** Sedang berlaku (sudah mulai, belum berakhir; ends_at kosong = selamanya). */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('starts_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}
