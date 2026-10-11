<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Voucher extends Model
{
    public const SOURCE_ADMIN = 'admin';

    public const SOURCE_GRANT = 'grant';

    public const SOURCE_ROYALTY = 'royalty';

    protected $fillable = [
        'code',
        'source',
        'user_id',
        'grant_id',
        'name',
        'targets',
        'discount_percent',
        'fee_percent',
        'max_uses',
        'cycle',
        'starts_at',
        'expires_at',
        'is_active',
        'reset_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'targets' => 'array',
            'discount_percent' => 'decimal:2',
            'fee_percent' => 'decimal:2',
            'max_uses' => 'integer',
            'cycle' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
            'reset_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function grant(): BelongsTo
    {
        return $this->belongsTo(VoucherGrant::class, 'grant_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public static function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/\s+/', '', $code));
    }

    /** Pesanan yang memakai voucher ini dan belum dibatalkan. */
    public function usesCount(): int
    {
        return $this->orders()->where('status', '!=', 'cancelled')->count();
    }

    /**
     * Status voucher: reset (direset admin), inactive (dimatikan / hak
     * vouchernya dicabut), scheduled, expired, exhausted (kuota pakai habis),
     * atau active. $uses boleh diisi dari withCount supaya tidak query lagi.
     */
    public function status(?Carbon $at = null, ?int $uses = null): string
    {
        $at ??= now();

        if ($this->reset_at) {
            return 'reset';
        }

        if (! $this->is_active) {
            return 'inactive';
        }

        if ($this->source === self::SOURCE_GRANT) {
            $grant = $this->grant;

            if (! $grant || ! $grant->is_active) {
                return 'inactive';
            }

            if ($grant->ends_at && $at->gte($grant->ends_at)) {
                return 'expired';
            }
        }

        if ($this->starts_at && $at->lt($this->starts_at)) {
            return 'scheduled';
        }

        if ($this->expires_at && $at->gte($this->expires_at)) {
            return 'expired';
        }

        if ($this->max_uses !== null && ($uses ?? $this->usesCount()) >= $this->max_uses) {
            return 'exhausted';
        }

        return 'active';
    }

    /** Apakah voucher ini berlaku untuk produk $type/$id (id null = semua). */
    public function appliesTo(string $type, int $id): bool
    {
        foreach ($this->targets ?? [] as $target) {
            if ($target['type'] === 'all') {
                return true;
            }

            if ($target['type'] === $type && ($target['id'] === null || (int) $target['id'] === $id)) {
                return true;
            }
        }

        return false;
    }
}
