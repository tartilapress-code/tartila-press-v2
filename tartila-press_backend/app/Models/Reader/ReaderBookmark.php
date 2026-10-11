<?php

namespace App\Models\Reader;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Penanda halaman buku milik pembaca. */
class ReaderBookmark extends Model
{
    protected $fillable = ['user_id', 'reader_book_id', 'page', 'note'];

    public function readerBook(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class);
    }
}
