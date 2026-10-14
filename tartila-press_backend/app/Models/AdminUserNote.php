<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Catatan admin tentang seorang pengguna (mis. penulis); tidak pernah dikirim ke pengguna itu. */
class AdminUserNote extends Model
{
    protected $fillable = ['user_id', 'note', 'updated_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
