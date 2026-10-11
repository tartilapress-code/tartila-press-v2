<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu kolom isian di formulir absensi sebuah event (diatur admin).
 */
class EventAttendanceField extends Model
{
    public const TYPES = [
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'select',
        'radio',
        'checkbox',
    ];

    /** Tipe yang punya daftar pilihan. */
    public const CHOICE_TYPES = ['select', 'radio'];

    protected $fillable = [
        'event_id',
        'key',
        'label',
        'type',
        'options',
        'required',
        'help_text',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'required' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }
}
