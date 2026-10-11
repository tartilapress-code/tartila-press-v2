<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu kejadian di riwayat proses penerbitan (mis. ISBN ditolak + catatan). */
class PublicationProcessEvent extends Model
{
    public const LABELS = [
        'isbn_submitted' => 'Pengajuan ISBN',
        'isbn_rejected' => 'ISBN ditolak',
        'isbn_published' => 'ISBN terbit',
        'hki_submitted' => 'Pengajuan HAKI',
        'hki_registered' => 'HAKI terbit',
        'printed' => 'Buku dicetak',
        'shipped' => 'Buku dikirim',
        'delivered' => 'Buku sampai',
    ];

    protected $fillable = [
        'publication_process_id',
        'stage',
        'note',
        'user_id',
    ];

    public function process(): BelongsTo
    {
        return $this->belongsTo(PublicationProcess::class, 'publication_process_id');
    }
}
