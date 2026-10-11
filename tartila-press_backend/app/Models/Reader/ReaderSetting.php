<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Model;

/** Pengaturan royalti baca (satu baris): persen pembelian & biaya per bacaan. */
class ReaderSetting extends Model
{
    protected $fillable = ['purchase_royalty_percent', 'read_fee'];

    protected function casts(): array
    {
        return [
            'purchase_royalty_percent' => 'float',
            'read_fee' => 'float',
        ];
    }

    public static function current(): self
    {
        return self::query()->first() ?? self::create([]);
    }
}
