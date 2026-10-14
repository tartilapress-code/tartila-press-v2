<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Cover extends Model
{
    protected $fillable = ['cover_project_id', 'round', 'position', 'kind', 'parent_cover_id', 'file_path', 'public_path', 'original_name', 'uploaded_by', 'purged_at'];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return ['round' => 'integer', 'position' => 'integer', 'purged_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CoverProject::class, 'cover_project_id');
    }
}
