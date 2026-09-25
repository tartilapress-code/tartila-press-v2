<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManuscriptReference extends Model
{
    use HasUuids;

    protected $table = 'pub_references';

    protected $fillable = [
        'manuscript_id',
        'citation',
        'order',
    ];

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }
}
