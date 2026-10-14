<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoverEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['cover_project_id', 'book_id', 'action', 'note', 'user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
