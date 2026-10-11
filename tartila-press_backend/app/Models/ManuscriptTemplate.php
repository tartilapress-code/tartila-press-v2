<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManuscriptTemplate extends Model
{
    protected $fillable = [
        'name',
        'description',
        'config',
        'is_active',
        'is_default',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
        ];
    }

    /** Template bawaan (dipakai bila admin tidak memilih yang lain). */
    public static function default(): ?self
    {
        return static::where('is_default', true)->first()
            ?? static::where('is_active', true)->oldest()->first();
    }
}
