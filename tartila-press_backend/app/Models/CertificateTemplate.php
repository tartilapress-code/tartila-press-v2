<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Templat sertifikat: gambar latar + daftar kolom teks yang ditandai admin.
 * Bentuk satu kolom di `fields` didokumentasikan di
 * App\Support\Certificates\TemplateFields.
 */
class CertificateTemplate extends Model
{
    public const TYPE_EVENT = 'event';

    public const TYPE_PUBLICATION = 'publication';

    /** Templat poster sosmed (Konten Sosmed); dipakai di browser, bukan untuk sertifikat. */
    public const TYPE_SOCIAL = 'social';

    public const TYPES = [self::TYPE_EVENT, self::TYPE_PUBLICATION, self::TYPE_SOCIAL];

    public const ROLE_AUTHOR = 'author';

    public const ROLE_EDITOR = 'editor';

    public const ROLES = [self::ROLE_AUTHOR, self::ROLE_EDITOR];

    protected $fillable = [
        'type',
        'name',
        'role',
        'image_path',
        'image_width',
        'image_height',
        'fields',
        'is_active',
        'created_by',
    ];

    protected $appends = [
        'image_url',
    ];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'image_width' => 'integer',
            'image_height' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected function imageUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->image_path
                ? Storage::disk(config('certificates.template_image.disk'))->url($this->image_path)
                : null,
        );
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class, 'certificate_template_id');
    }

    /**
     * Templat aktif untuk sertifikat penulis/editor dengan peran ini: yang
     * khusus peran itu didahulukan, lalu yang berlaku untuk semua peran;
     * kalau ada beberapa, yang terbaru diubah.
     */
    public static function resolveForPublication(string $role): ?self
    {
        return static::query()
            ->active()
            ->ofType(self::TYPE_PUBLICATION)
            ->where(fn (Builder $query) => $query->where('role', $role)->orWhereNull('role'))
            ->orderByRaw('case when role is null then 1 else 0 end')
            ->latest('updated_at')
            ->latest('id')
            ->first();
    }
}
