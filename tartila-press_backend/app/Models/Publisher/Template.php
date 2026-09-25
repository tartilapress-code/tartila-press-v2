<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Template extends Model
{
    use HasUuids;

    protected $table = 'pub_templates';

    protected $fillable = [
        'name',
        'slug',
        'structure_config',
        'page_numbering_config',
        'theme_config',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'structure_config' => 'array',
        'page_numbering_config' => 'array',
        'theme_config' => 'array',
        'is_active' => 'boolean',
    ];

    public function manuscripts(): HasMany
    {
        return $this->hasMany(Manuscript::class);
    }
}
