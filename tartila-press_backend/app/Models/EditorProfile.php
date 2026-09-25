<?php

namespace App\Models;

use App\Casts\LanguageList;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EditorProfile extends Model
{
    protected $fillable = [
        'user_id',
        'fee',
        'bio',
        'languages',
        'is_available',
    ];

    // JSON mentah, supaya profil yang baru dibuat langsung memuat daftar kosong.
    protected $attributes = [
        'languages' => '[]',
    ];

    protected function casts(): array
    {
        return [
            'fee' => 'decimal:2',
            'languages' => LanguageList::class,
            'is_available' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
