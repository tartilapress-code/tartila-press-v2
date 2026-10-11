<?php

namespace App\Models\Reader;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReaderComment extends Model
{
    protected $fillable = ['reader_book_id', 'user_id', 'body'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->select(['id', 'name']);
    }

    public function readerBook(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class);
    }
}
