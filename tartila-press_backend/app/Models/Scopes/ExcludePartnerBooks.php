<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Buku mitra (partner_id terisi) hanya ada di Tartila Book: semua query Book di Tartila Press
 * otomatis mengabaikannya. Kode Tartila Book/royalti memintanya dengan
 * `Book::withoutGlobalScope(ExcludePartnerBooks::class)` atau relasi `partnerBooks`.
 */
class ExcludePartnerBooks implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $builder->whereNull($model->getTable().'.partner_id');
    }
}
