<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Proses penerbitan satu karya setelah naskah selesai (ISBN Perpusnas dan
 * buku fisik). Subjeknya sama dengan HKI: pesanan paket ("order") atau
 * proyek Book Chapter / buku ("book").
 */
class PublicationProcess extends Model
{
    public const ISBN_SUBMITTED = 'submitted';

    public const ISBN_REJECTED = 'rejected';

    public const ISBN_PUBLISHED = 'published';

    public const PHYSICAL_STEPS = ['printed', 'shipped', 'delivered'];

    /** Halaman pelacakan resi ISBN di Perpusnas. */
    public const ISBN_TRACKING_URL = 'https://isbn.perpusnas.go.id/landing_page/pelacakan';

    protected $fillable = [
        'subject_type',
        'subject_id',
        'isbn_status',
        'isbn_receipt',
        'isbn_note',
        'isbn_number',
        'isbn_submitted_at',
        'isbn_rejected_at',
        'isbn_published_at',
        'includes_physical',
        'physical_status',
        'physical_note',
        'printed_at',
        'shipped_at',
        'delivered_at',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'subject_id' => 'integer',
            'includes_physical' => 'boolean',
            'isbn_submitted_at' => 'datetime',
            'isbn_rejected_at' => 'datetime',
            'isbn_published_at' => 'datetime',
            'printed_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function events(): HasMany
    {
        return $this->hasMany(PublicationProcessEvent::class)->orderBy('created_at')->orderBy('id');
    }
}
