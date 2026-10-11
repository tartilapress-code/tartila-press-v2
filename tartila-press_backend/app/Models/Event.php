<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Event extends Model
{
    protected static function booted(): void
    {
        static::creating(function (Event $event) {
            if (! $event->slug) {
                $event->slug = static::generateUniqueSlug($event->title);
            }
        });
    }

    protected $fillable = [
        'title',
        'slug',
        'description',
        'event_category_id',
        'banner',
        'starts_at',
        'ends_at',
        'registration_deadline',
        'requires_document',
        'requires_meet_link',
        'meet_link',
        'youtube_url',
        'certificate_url',
        'attendance_enabled',
        'attendance_opens_at',
        'attendance_closes_at',
        'certificate_template_id',
        'fee',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'registration_deadline' => 'datetime',
            'requires_document' => 'boolean',
            'requires_meet_link' => 'boolean',
            'attendance_enabled' => 'boolean',
            'attendance_opens_at' => 'datetime',
            'attendance_closes_at' => 'datetime',
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Status absensi: disabled (tidak dipakai), upcoming (belum dibuka), open
     * (sedang dibuka), closed (sudah ditutup).
     */
    public function attendanceState(): string
    {
        if (! $this->attendance_enabled) {
            return 'disabled';
        }

        $now = now();

        if ($this->attendance_opens_at && $now->lt($this->attendance_opens_at)) {
            return 'upcoming';
        }

        if ($this->attendance_closes_at && $now->gt($this->attendance_closes_at)) {
            return 'closed';
        }

        return 'open';
    }

    public static function generateUniqueSlug(string $title): string
    {
        $baseSlug = Str::slug($title) ?: 'event';
        $slug = $baseSlug;
        $counter = 1;

        while (static::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(EventCategory::class, 'event_category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(EventRegistration::class);
    }

    public function attendanceFields(): HasMany
    {
        return $this->hasMany(EventAttendanceField::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(EventAttendance::class);
    }

    public function certificateTemplate(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplate::class, 'certificate_template_id');
    }
}
