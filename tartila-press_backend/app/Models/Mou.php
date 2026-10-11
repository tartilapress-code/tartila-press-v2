<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * MOU distribusi buku untuk SATU judul: paket biasa (per naskah) atau Book
 * Chapter (per buku). `content` adalah salinan isi template saat dibuat —
 * dikunci begitu ada penulis yang menandatangani.
 *
 * Status: pending (menunggu tanda tangan penulis) → signed (semua penulis
 * sudah, menunggu penerbit + meterai) → completed (PDF bermeterai diunggah).
 */
class Mou extends Model
{
    public const TYPE_REGULAR = 'regular';

    public const TYPE_CHAPTER = 'chapter';

    public const STATUS_PENDING = 'pending';

    public const STATUS_SIGNED = 'signed';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_LABELS = [
        'pending' => 'Menunggu tanda tangan penulis',
        'signed' => 'Menunggu tanda tangan & meterai penerbit',
        'completed' => 'Selesai (bermeterai)',
    ];

    protected $fillable = [
        'type',
        'manuscript_id',
        'book_id',
        'number',
        'title',
        'content',
        'distribution_choice',
        'customized',
        'status',
        'signed_at',
        'final_pdf_path',
        'final_pdf_name',
        'final_uploaded_at',
        'updated_by',
    ];

    protected $hidden = [
        'final_pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'distribution_choice' => 'array',
            'customized' => 'boolean',
            'signed_at' => 'datetime',
            'final_uploaded_at' => 'datetime',
        ];
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }

    public function signatories(): HasMany
    {
        return $this->hasMany(MouSignatory::class)->orderBy('position')->orderBy('id');
    }

    public function addenda(): HasMany
    {
        return $this->hasMany(MouAddendum::class)->latest();
    }

    /** Semua penulis sudah menandatangani → royalti mengikuti MOU ini. */
    public function isBinding(): bool
    {
        return in_array($this->status, [self::STATUS_SIGNED, self::STATUS_COMPLETED], true);
    }
}
