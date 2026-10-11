<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Buku besar sertifikat yang sudah terbit: memberi nomor yang tetap dan
 * tanggal terbit. Isi sertifikatnya sendiri tidak disimpan -- PDF dirender
 * ulang dari templat dan data terkini (absensi / buku) setiap kali diunduh.
 */
class Certificate extends Model
{
    public const TYPE_EVENT = 'event';

    public const TYPE_PUBLICATION = 'publication';

    protected static function booted(): void
    {
        static::created(function (Certificate $certificate) {
            if ($certificate->number) {
                return;
            }

            $code = $certificate->type === self::TYPE_EVENT ? 'EVT' : 'PUB';

            $certificate->forceFill([
                'number' => sprintf(
                    '%s-%s-%s-%06d',
                    config('certificates.number_prefix', 'TP'),
                    $code,
                    $certificate->issued_at->format('Y'),
                    $certificate->id
                ),
            ])->saveQuietly();
        });
    }

    protected $fillable = [
        'number',
        'type',
        'user_id',
        'event_attendance_id',
        'book_id',
        'role',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
        ];
    }

    /**
     * Kategori di halaman "Sertifikat Saya": event, author, atau editor.
     */
    public function category(): string
    {
        return $this->type === self::TYPE_EVENT ? 'event' : (string) $this->role;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(EventAttendance::class, 'event_attendance_id');
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }
}
