<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManuscriptAuthor extends Model
{
    protected $fillable = [
        'manuscript_id',
        'user_id',
        'position',
        'approved_at',
        // Co-author layanan paket: penulis terakhir, tidak ikut menyetujui tinjauan penulis.
        'is_coauthor',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'approved_at' => 'datetime',
            'is_coauthor' => 'boolean',
        ];
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
