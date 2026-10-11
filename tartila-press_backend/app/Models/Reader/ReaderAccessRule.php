<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jadwal buka (baca gratis) / kunci sebuah buku (atau semua buku). Tanpa
 * aturan yang berlaku, buku terkunci kecuali dibeli / langganan / penulis.
 */
class ReaderAccessRule extends Model
{
    public const ACTIONS = ['open' => 'Dibuka (baca gratis)', 'lock' => 'Dikunci'];

    protected $fillable = ['reader_book_id', 'action', 'starts_at', 'ends_at', 'note'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function readerBook(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('starts_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}
