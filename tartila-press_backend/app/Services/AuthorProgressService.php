<?php

namespace App\Services;

use App\Models\Manuscript;
use Illuminate\Support\Collection;

/**
 * Catatan progres / hak penulis yang belum selesai (untuk Kelola Penulis), disusun otomatis
 * dari data yang ada. Setiap catatan memuat JUDUL buku/naskahnya:
 *  - naskah masih dalam proses (beserta tahapnya);
 *  - MOU belum ditandatangani penulis;
 *  - naskah selesai tetapi belum diterbitkan sebagai buku;
 *  - ISBN, HAKI, dan buku fisik yang termasuk paket tetapi belum selesai.
 */
class AuthorProgressService
{
    public function __construct(private readonly PublicationProcessService $publication) {}

    /**
     * @param  Collection<int, Manuscript>  $manuscripts  naskah milik satu penulis (relasi mou.signatories, book, bookChapter dimuat)
     * @return list<array{type: string, title: string, text: string}>
     */
    public function notesFor(int $userId, Collection $manuscripts): array
    {
        $notes = [];

        foreach ($manuscripts->sortBy('id') as $manuscript) {
            $title = $manuscript->title;

            if ($manuscript->status !== 'completed') {
                $notes[] = [
                    'type' => 'manuscript',
                    'title' => $title,
                    'text' => 'Naskah dalam proses: '.(HkiService::MANUSCRIPT_STATUS[$manuscript->status] ?? $manuscript->status),
                ];

                continue;
            }

            $signatory = $manuscript->mou?->signatories->firstWhere('user_id', $userId);

            if ($signatory && $signatory->signed_at === null) {
                $notes[] = ['type' => 'mou', 'title' => $title, 'text' => 'MOU distribusi belum ditandatangani penulis'];
            }

            $isChapter = $manuscript->bookChapter !== null || $manuscript->compiled_book_id !== null;

            if (! $isChapter && $manuscript->book === null) {
                $notes[] = ['type' => 'book', 'title' => $title, 'text' => 'Buku belum diterbitkan'];
            }

            $progress = $this->publication->progressForManuscript($manuscript);

            if ($progress === null || $progress['completed']) {
                continue;
            }

            $labels = ['isbn' => 'ISBN belum terbit', 'hki' => 'HAKI belum terbit', 'physical' => 'Buku fisik belum sampai'];

            foreach ($progress['sections'] as $section) {
                if (! $section['included']) {
                    continue;
                }

                $pending = collect($section['steps'])->first(fn (array $step) => $step['state'] !== 'done');

                if ($pending === null) {
                    continue;
                }

                $notes[] = [
                    'type' => $section['key'],
                    'title' => $progress['title'] ?? $title,
                    'text' => ($labels[$section['key']] ?? $section['title'].' belum selesai').' — tahap: '.$pending['label'],
                ];
            }
        }

        return $notes;
    }
}
