<?php

namespace App\Models;

use App\Models\Scopes\ExcludePartnerBooks;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Penerbit mitra Tartila Book (akun ber-role mitra). */
class Partner extends Model
{
    protected $fillable = ['user_id', 'company_name', 'phone', 'address', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Buku mitra ini (di luar saringan buku mitra Tartila Press). */
    public function books(): HasMany
    {
        return $this->hasMany(Book::class)->withoutGlobalScope(ExcludePartnerBooks::class);
    }
}
