<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManuscriptRevision extends Model
{
    protected $fillable = [
        'manuscript_id',
        'revision_number',
        'uploaded_by',
        'role',
        'file_path',
        'original_filename',
        'note',
        'admin_status',
        'admin_note',
        // Catatan penulis saat meminta revisi lagi (terpisah dari catatan admin).
        'author_note',
        'file_purged_at',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'file_purged_at' => 'datetime',
        ];
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
