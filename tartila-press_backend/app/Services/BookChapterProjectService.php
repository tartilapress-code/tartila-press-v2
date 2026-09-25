<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use Illuminate\Support\Facades\DB;

class BookChapterProjectService
{
    public function __construct(
        private readonly BookChapterCostCalculator $calculator,
    ) {}

    /**
     * Sertakan ringkasan biaya & fee (cost_summary) pada respons proyek.
     */
    public function withCostSummary(Book $book, ?BookChapterSetting $settings = null): Book
    {
        $book->loadMissing(['chapters', 'packageItems']);
        $book->setAttribute(
            'cost_summary',
            $this->calculator->summarize($book, $settings ?? BookChapterSetting::current())
        );

        return $book;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $chapters
     * @param  array<int, int>  $packageItemIds  fasilitas/layanan (item paket custom) yang dicentang
     */
    public function createProject(
        array $data,
        int $creatorId,
        bool $isEditorCreated,
        ?int $ownerEditorId,
        array $chapters,
        array $packageItemIds = [],
    ): Book {
        return DB::transaction(function () use ($data, $creatorId, $isEditorCreated, $ownerEditorId, $chapters, $packageItemIds) {
            $book = Book::create([
                ...$data,
                'authors' => [],
                'authors_text' => null,
                'is_chapter_compilation' => true,
                'is_chapter_offering' => true,
                'is_editor_created' => $isEditorCreated,
                'is_active' => false,
                'created_by' => $creatorId,
                'owner_editor_id' => $ownerEditorId,
            ]);

            foreach ($chapters as $index => $chapterData) {
                $book->chapters()->create([
                    'chapter_number' => $index + 1,
                    'title' => $chapterData['title'],
                    'price' => $chapterData['price'] ?? null,
                    'discount' => $chapterData['discount'] ?? null,
                    'sop_terms' => $chapterData['sop_terms'] ?? null,
                ]);
            }

            $book->packageItems()->sync($packageItemIds);

            return $book->load(['chapters', 'packageItems']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addChapter(Book $book, array $data): BookChapter
    {
        $nextNumber = (int) ($book->chapters()->max('chapter_number') ?? 0) + 1;

        return $book->chapters()->create([
            'chapter_number' => $nextNumber,
            'title' => $data['title'],
            'price' => $data['price'] ?? null,
            'discount' => $data['discount'] ?? null,
            'sop_terms' => $data['sop_terms'] ?? null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateChapter(BookChapter $chapter, array $data): BookChapter
    {
        $chapter->update([
            'title' => $data['title'] ?? $chapter->title,
            'price' => array_key_exists('price', $data) ? $data['price'] : $chapter->price,
            'discount' => array_key_exists('discount', $data) ? $data['discount'] : $chapter->discount,
            'sop_terms' => array_key_exists('sop_terms', $data) ? $data['sop_terms'] : $chapter->sop_terms,
        ]);

        return $chapter;
    }

    public function assertChapterDeletable(BookChapter $chapter): void
    {
        abort_if(
            $chapter->manuscript_id || $chapter->order_id,
            422,
            'Slot bab ini sudah dipesan/terisi, tidak bisa dihapus.'
        );
    }

    public function deleteChapter(BookChapter $chapter): void
    {
        $this->assertChapterDeletable($chapter);

        $chapter->delete();
    }

    /**
     * @param  array<int, int>  $packageItemIds
     */
    public function syncPackageItems(Book $book, array $packageItemIds): void
    {
        $book->packageItems()->sync($packageItemIds);
    }
}
