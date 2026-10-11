<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Isi halaman "Tentang Kami" (satu baris). */
class AboutProfile extends Model
{
    /** Sosial media yang bisa diisi admin (kosong = tidak ditampilkan). */
    public const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'linkedin', 'website'];

    protected $fillable = [
        'vision',
        'mission',
        'profile',
        'contact_email',
        'phone',
        'whatsapp',
        'address',
        'map_query',
        'social_links',
        'show_team',
        'updated_by',
    ];

    protected $hidden = [
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'social_links' => 'array',
            'show_team' => 'boolean',
        ];
    }

    public static function current(): self
    {
        return static::query()->first() ?? static::create(['show_team' => true]);
    }
}
