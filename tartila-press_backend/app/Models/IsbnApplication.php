<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IsbnApplication extends Model
{
    public const TYPE_REGULAR = 'regular';

    public const TYPE_CHAPTER = 'chapter';

    public const STATUS_DRAFT = 'draft';

    /** Ditandatangani penulis/editor, menunggu tanda tangan + stempel admin. */
    public const STATUS_SIGNED = 'signed';

    /** Admin sudah mengunduh surat bertanda tangan + stempel. */
    public const STATUS_PROCESSED = 'processed';

    protected $fillable = [
        'type',
        'manuscript_id',
        'book_id',
        'applicant_id',
        'title',
        'authors_text',
        'availability_link',
        'letter_number',
        'letter_date',
        'applicant_data',
        'form_data',
        'signature_path',
        'signed_at',
        'status',
        'processed_by',
        'processed_at',
    ];

    // Tanda tangan penulis tidak ikut ke API; hanya penanda sudah/belum.
    protected $hidden = [
        'signature_path',
        'form_data',
    ];

    protected $appends = [
        'is_signed',
        'signer_role',
    ];

    protected function casts(): array
    {
        return [
            'letter_date' => 'date',
            'applicant_data' => 'array',
            'form_data' => 'array',
            'signed_at' => 'datetime',
            'processed_at' => 'datetime',
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

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    public function getIsSignedAttribute(): bool
    {
        return $this->signed_at !== null;
    }

    /** Penanda tangan surat keaslian: penulis pertama (paket biasa) atau editor (Book Chapter). */
    public function getSignerRoleAttribute(): string
    {
        return $this->type === self::TYPE_CHAPTER ? 'Editor' : 'Penulis';
    }
}
