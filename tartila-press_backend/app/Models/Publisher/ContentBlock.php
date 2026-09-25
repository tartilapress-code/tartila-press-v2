<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentBlock extends Model
{
    use HasUuids;

    protected $table = 'pub_content_blocks';

    protected $fillable = [
        'chapter_id',
        'type',
        'order',
        'content',
    ];

    protected $casts = [
        'content' => 'array',
    ];

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(ManuscriptChapter::class, 'chapter_id');
    }
}
