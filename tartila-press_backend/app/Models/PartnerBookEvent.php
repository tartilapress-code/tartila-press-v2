<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Riwayat pengajuan / persetujuan / penolakan satu buku mitra. */
class PartnerBookEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['book_id', 'action', 'note', 'user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
