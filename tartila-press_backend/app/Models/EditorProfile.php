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
        // Layanan co-author: editor yang mencentang bisa menyusun naskah mentah penulis.
        'is_coauthor',
        'coauthor_fee',
        'coauthor_bio',
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
            'is_coauthor' => 'boolean',
            // Kelola Editor (diatur admin).
            'is_banned' => 'boolean',
            'is_promoted' => 'boolean',
            'banned_at' => 'datetime',
            'promoted_at' => 'datetime',
            'coauthor_fee' => 'decimal:2',
            // Bidang keahlian (id Kategori Keilmuan), diatur admin.
            'field_category_ids' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
