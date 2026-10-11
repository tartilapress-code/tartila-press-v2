<?php

namespace App\Support;

use App\Models\Book;
use App\Models\BookChapter;

/**
 * Data poster promosi proyek Book Chapter untuk sosmed: bidang, judul, judul
 * tiap bab dan jumlah slot yang masih terbuka. Selalu dihitung saat diminta,
 * jadi gambar yang diunduh memakai data terbaru.
 */
class BookChapterPromo
{
    /** @return array<string, mixed> */
    public static function present(Book $project): array
    {
        $project->loadMissing(['fieldCategory:id,name', 'category:id,name', 'ownerEditor.publicProfile', 'creator.publicProfile', 'chapters']);

        $chapters = $project->chapters->sortBy('chapter_number')->values();
        $isOpen = fn (BookChapter $chapter) => $chapter->manuscript_id === null && $chapter->order_id === null;

        // Editor proyek: editor pemilik, atau editor pembuat proyek buatan editor.
        $editor = $project->ownerEditor ?? ($project->is_editor_created ? $project->creator : null);

        return [
            'id' => $project->id,
            'title' => $project->title,
            'field' => $project->fieldCategory?->name,
            'category' => $project->category?->name,
            'editor_name' => $editor ? ($editor->publicProfile?->pen_name ?: $editor->name) : null,
            'submission_deadline' => $project->submission_deadline?->toDateString(),
            'chapters' => $chapters->map(fn (BookChapter $chapter) => [
                'number' => $chapter->chapter_number,
                'title' => $chapter->title,
                'open' => $isOpen($chapter),
            ])->all(),
            'open_slots' => $chapters->filter($isOpen)->count(),
            'total_slots' => $chapters->count(),
            'url' => rtrim((string) config('app.frontend_url'), '/').'/buku-bab/'.$project->id,
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
