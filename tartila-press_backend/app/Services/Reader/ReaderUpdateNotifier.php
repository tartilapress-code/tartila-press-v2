<?php

namespace App\Services\Reader;

use App\Models\Book;
use App\Models\Reader\ReaderBook;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;

/** Ebook sebuah buku diganti di Tartila Press: naikkan versi dan beri tahu yang menyimpannya di Tartila Book. */
class ReaderUpdateNotifier
{
    public function __construct(private readonly Notifier $notifier) {}

    public function ebookReplaced(Book $book): void
    {
        $readerBook = ReaderBook::where('book_id', $book->id)->first();

        if (! $readerBook) {
            return;
        }

        $readerBook->increment('version');

        if (! $readerBook->is_published) {
            return;
        }

        $this->notifier->guard(fn () => $this->notifier->notify(
            User::whereIn('id', DB::table('reader_saves')->where('reader_book_id', $readerBook->id)->pluck('user_id'))->get(),
            'reader',
            'Buku diperbarui',
            "{$book->title} — Ada versi terbaru dari buku yang Anda simpan.",
            "/buku/{$readerBook->id}",
            ['subject_type' => 'reader_book', 'subject_id' => $readerBook->id]
        ));
    }
}
