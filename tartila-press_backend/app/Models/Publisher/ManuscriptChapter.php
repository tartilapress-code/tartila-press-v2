<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ManuscriptChapter extends Model
{
    use HasUuids;

    protected $table = 'pub_manuscript_chapters';

    protected $fillable = [
        'manuscript_id',
        'title',
        'order',
    ];

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(ContentBlock::class, 'chapter_id')->orderBy('order');
    }
}
