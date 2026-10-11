<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class VoucherGrant extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'targets',
        'pool_percent',
        'max_vouchers',
        'period_days',
        'starts_at',
        'ends_at',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'targets' => 'array',
            'pool_percent' => 'decimal:2',
            'max_vouchers' => 'integer',
            'period_days' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class, 'grant_id');
    }

    /**
     * Nomor periode saat ini (0, 1, 2, ...), atau null kalau hak ini belum
     * mulai, sudah berakhir, atau dinonaktifkan admin. Periode berulang tiap
     * period_days: begitu periode berganti, kuota kembali penuh dan voucher
     * periode sebelumnya tidak bisa dipakai lagi (reset).
     */
    public function currentCycle(?Carbon $at = null): ?int
    {
        $at ??= now();

        if (! $this->is_active || $at->lt($this->starts_at)) {
            return null;
        }

        if ($this->ends_at && $at->gte($this->ends_at)) {
            return null;
        }

        return intdiv(
            (int) $this->starts_at->diffInSeconds($at, true),
            max(1, $this->period_days) * 86400
        );
    }

    public function cycleStart(int $cycle): Carbon
    {
        return $this->starts_at->copy()->addDays($cycle * $this->period_days);
    }

    /** Akhir periode (dibatasi ends_at hak kalau ada). */
    public function cycleEnd(int $cycle): Carbon
    {
        $end = $this->starts_at->copy()->addDays(($cycle + 1) * $this->period_days);

        return $this->ends_at && $this->ends_at->lt($end) ? $this->ends_at->copy() : $end;
    }

    public function usedQuota(?int $cycle = null): int
    {
        $cycle ??= $this->currentCycle();

        // Voucher yang direset admin tidak menghabiskan kuota lagi.
        return $cycle === null
            ? 0
            : $this->vouchers()->where('cycle', $cycle)->whereNull('reset_at')->count();
    }

    public function status(?Carbon $at = null): string
    {
        $at ??= now();

        if (! $this->is_active) {
            return 'inactive';
        }

        if ($at->lt($this->starts_at)) {
            return 'scheduled';
        }

        return $this->ends_at && $at->gte($this->ends_at) ? 'expired' : 'active';
    }
}
