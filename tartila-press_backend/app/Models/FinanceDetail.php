<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Isian admin untuk rincian keuangan satu pesanan paket (order), proyek
 * Book Chapter / buku (book) atau event. Kolom kosong = pakai nilai otomatis.
 */
class FinanceDetail extends Model
{
    public const SUBJECTS = ['order', 'book', 'event'];

    protected $fillable = [
        'subject_type',
        'subject_id',
        'book_price',
        'extra_copies',
        'includes_hki',
        'admin_cover_cost',
        'speaker_fee',
        'other_costs',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'subject_id' => 'integer',
            'book_price' => 'float',
            'extra_copies' => 'integer',
            'includes_hki' => 'boolean',
            'admin_cover_cost' => 'float',
            'speaker_fee' => 'float',
            'other_costs' => 'float',
        ];
    }
}
