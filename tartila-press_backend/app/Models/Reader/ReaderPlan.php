<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/** Paket langganan: semua buku bisa dibaca selama periodenya. */
class ReaderPlan extends Model
{
    public const PERIODS = [
        'daily' => 'Harian',
        'weekly' => 'Mingguan',
        'monthly' => 'Bulanan',
        'yearly' => 'Tahunan',
    ];

    protected $fillable = ['name', 'period', 'price', 'description', 'is_active'];

    protected function casts(): array
    {
        return [
            'price' => 'float',
            'is_active' => 'boolean',
        ];
    }

    /** Waktu berakhir bila dimulai pada $start. */
    public function endsAt(Carbon $start): Carbon
    {
        $start = $start->copy();

        return match ($this->period) {
            'daily' => $start->addDay(),
            'weekly' => $start->addWeek(),
            'monthly' => $start->addMonthNoOverflow(),
            default => $start->addYearNoOverflow(),
        };
    }
}
