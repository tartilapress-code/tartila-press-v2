<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoverVote extends Model
{
    protected $fillable = ['cover_project_id', 'round', 'user_id', 'cover_id', 'note'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
