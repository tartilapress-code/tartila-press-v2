<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan revisi untuk satu bab Book Chapter, diberikan editor/admin saat
 * mengerjakan naskah gabungan dan dikirim ke penulis bab tersebut.
 */
class ChapterRevisionRequest extends Model
{
    protected $fillable = [
        'compilation_id',
        'manuscript_id',
        'requested_by',
        'note',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }

    public function compilation(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class, 'compilation_id');
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
