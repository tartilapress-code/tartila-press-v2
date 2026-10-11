<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pengurusan HKI satu karya (pesanan paket atau buku/proyek Book Chapter). */
class HkiRecord extends Model
{
    public const STATUSES = [
        'pending' => 'Belum diajukan',
        'submitted' => 'Sedang diproses',
        'registered' => 'Terdaftar',
    ];

    public const SUBJECTS = ['order', 'book'];

    protected $fillable = [
        'subject_type',
        'subject_id',
        'status',
        'application_number',
        'registration_number',
        'registered_at',
        'certificate_path',
        'certificate_name',
        'certificate_uploaded_at',
        'note',
        'updated_by',
    ];

    protected $hidden = [
        'certificate_path',
    ];

    protected function casts(): array
    {
        return [
            'subject_id' => 'integer',
            'registered_at' => 'date',
            'certificate_uploaded_at' => 'datetime',
        ];
    }

    public function hasCertificate(): bool
    {
        return $this->certificate_path !== null;
    }
}
