<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Adendum MOU (PDF yang sudah disepakati kedua pihak), diunggah admin. */
class MouAddendum extends Model
{
    protected $table = 'mou_addenda';

    protected $fillable = [
        'mou_id',
        'title',
        'note',
        'file_path',
        'file_name',
        'created_by',
    ];

    protected $hidden = [
        'file_path',
    ];

    public function mou(): BelongsTo
    {
        return $this->belongsTo(Mou::class);
    }
}
