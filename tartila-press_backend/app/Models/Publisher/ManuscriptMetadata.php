<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManuscriptMetadata extends Model
{
    use HasUuids;

    protected $table = 'pub_manuscript_metadata';

    protected $fillable = [
        'manuscript_id',
        'author',
        'editor',
        'designer',
        'foreword',
        'custom_fields',
    ];

    protected $casts = [
        'custom_fields' => 'array',
    ];

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }
}
