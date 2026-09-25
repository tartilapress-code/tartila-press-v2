<?php

namespace App\Casts;

use App\Support\Languages;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Kolom JSON berisi kode bahasa. Saat dibaca selalu berupa array (kosong bila
 * belum diisi); saat ditulis dirapikan lewat Languages::normalize().
 *
 * @implements CastsAttributes<list<string>, mixed>
 */
class LanguageList implements CastsAttributes
{
    /**
     * @return list<string>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return Languages::normalize($decoded);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode(Languages::normalize($value));
    }
}
