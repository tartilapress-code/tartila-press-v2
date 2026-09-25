<?php

namespace App\Console\Commands;

use App\Models\Book;
use Illuminate\Console\Command;

class RevertExpiredBookChapterProjects extends Command
{
    protected $signature = 'book-chapters:revert-expired';

    protected $description = 'Kosongkan owner_editor_id proyek Book Chapter buatan editor yang lewat deadline pengumpulan naskah dan belum penuh (kembali ke admin).';

    public function handle(): int
    {
        $expired = Book::query()
            ->where('is_editor_created', true)
            ->whereNotNull('owner_editor_id')
            ->whereNotNull('submission_deadline')
            ->where('submission_deadline', '<', now())
            ->whereHas('chapters', fn ($query) => $query->whereNull('manuscript_id'))
            ->get();

        foreach ($expired as $book) {
            $previousOwnerId = $book->owner_editor_id;

            $book->update(['owner_editor_id' => null]);

            $this->info("Book #{$book->id} '{$book->title}': owner editor #{$previousOwnerId} dikembalikan ke admin.");
        }

        $this->info(count($expired).' proyek dikembalikan ke admin.');

        return self::SUCCESS;
    }
}
