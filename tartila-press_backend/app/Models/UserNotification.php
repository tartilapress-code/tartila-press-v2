<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu notifikasi di aplikasi untuk satu user. */
class UserNotification extends Model
{
    protected $fillable = [
        'user_id',
        'category',
        'title',
        'body',
        'link',
        'subject_type',
        'subject_id',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'subject_id' => 'integer',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }
}
