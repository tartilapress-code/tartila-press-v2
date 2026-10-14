<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu penulis penanda tangan MOU: royaltinya dan waktu tanda tangan. */
class MouSignatory extends Model
{
    protected $fillable = [
        'mou_id',
        'user_id',
        'position',
        'royalty_physical',
        'royalty_ebook',
        'chapters',
        'is_coauthor',
        'identity',
        'agreed_at',
        'signed_at',
        'signature_path',
    ];

    protected $hidden = [
        'signature_path',
        'identity',
    ];

    protected function casts(): array
    {
        return [
            'royalty_physical' => 'float',
            'royalty_ebook' => 'float',
            'identity' => 'array',
            'is_coauthor' => 'boolean',
            'agreed_at' => 'datetime',
            'signed_at' => 'datetime',
        ];
    }

    public function mou(): BelongsTo
    {
        return $this->belongsTo(Mou::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
