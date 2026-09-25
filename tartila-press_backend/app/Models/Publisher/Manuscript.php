<?php

namespace Modules\Publisher\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Manuscript extends Model
{
    use HasUuids;

    protected $table = 'pub_manuscripts';

    protected $fillable = [
        'template_id',
        'title',
        'status',
        'isbn',
        'published_at',
        'published_book_id',
        'created_by',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    public function metadata(): HasOne
    {
        return $this->hasOne(ManuscriptMetadata::class);
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(ManuscriptChapter::class)->orderBy('order');
    }

    public function references(): HasMany
    {
        return $this->hasMany(ManuscriptReference::class)->orderBy('order');
    }
}
