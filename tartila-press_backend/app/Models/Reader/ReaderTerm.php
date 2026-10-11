<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Model;

/** Pilihan taksonomi Tartila Book: bidang pendidikan, kategori buku, genre. */
class ReaderTerm extends Model
{
    public const TYPES = [
        'education_field' => 'Bidang pendidikan',
        'category' => 'Kategori buku',
        'genre' => 'Genre',
    ];

    protected $fillable = ['type', 'name', 'pustaka'];
}
