<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\ChapterRevisionRequest;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\User;
use App\Support\ManuscriptTemplates\DocxMerger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Book Chapter: naskah tiap bab diperiksa admin satu per satu, lalu setelah
 * semua terkumpul digabung menjadi SATU naskah buku (urut nomor bab) yang
 * dikerjakan editor. Catatan revisi diberikan per bab dan dikirim ke penulis
 * bab tersebut; setelah naskah gabungan disetujui semua penulis, semua bab
 * ikut selesai.
 */
class BookChapterCompilationService
{
    /** Status bab yang boleh digabung (selesai = alur lama per bab). */
    private const READY_STATUSES = [
        Manuscript::STATUS_AWAITING_COMPILATION,
        Manuscript::STATUS_COMPILED,
        'completed',
    ];

    /** Naskah gabungan yang masih boleh digabung ulang. */
    private const RECOMPILABLE = ['pending_editor_assignment', 'in_editing', 'editor_revision_requested'];

    public function __construct(private readonly ManuscriptAutoLayoutService $autoLayout) {}

    /** Slot bab proyek Book Chapter yang diisi naskah ini (null kalau bukan). */
    public function chapterOf(Manuscript $manuscript): ?BookChapter
    {
        $chapter = $manuscript->bookChapter()->with('book')->first();

        return $chapter?->book?->is_chapter_offering ? $chapter : null;
    }

    /**
     * Status penggabungan proyek: bab, naskah, berkas, hambatan.
     *
     * @return array<string, mixed>
     */
    public function overview(Book $book): array
    {
        $book->load(['chapters.manuscript.user', 'chapters.manuscript.revisions', 'compilation.editor']);

        $chapters = $book->chapters->map(function (BookChapter $chapter) {
            $manuscript = $chapter->manuscript;
            $source = $manuscript ? $this->sourceRevision($manuscript) : null;

            return [
                'id' => $chapter->id,
                'chapter_number' => $chapter->chapter_number,
                'title' => $chapter->title,
                'manuscript' => $manuscript ? [
                    'id' => $manuscript->id,
                    'status' => $manuscript->status,
                    'author' => $manuscript->user?->name,
                    'ready' => in_array($manuscript->status, self::READY_STATUSES, true),
                    'file' => $source?->original_filename,
                    'is_docx' => $source !== null && $this->isDocx($source),
                ] : null,
            ];
        })->values();

        $compilation = $book->compilation;

        return [
            'chapters' => $chapters,
            'filled' => $chapters->whereNotNull('manuscript')->count(),
            'missing' => $chapters->whereNull('manuscript')->count(),
            'blockers' => $this->blockers($book),
            'compilation' => $compilation ? [
                'id' => $compilation->id,
                'status' => $compilation->status,
                'editor' => $compilation->editor?->name,
                'can_recompile' => in_array($compilation->status, self::RECOMPILABLE, true),
            ] : null,
        ];
    }

    /**
     * Gabungkan semua bab (urut nomor) menjadi naskah buku. Pertama kali:
     * naskah gabungan dibuat dan dikirim ke editor; berikutnya: menambah
     * revisi gabungan baru (mis. setelah ada bab yang direvisi).
     */
    public function compile(Book $book, User $admin, ?ManuscriptTemplate $template, bool $allowMissing): Manuscript
    {
        abort_unless($book->is_chapter_offering, 422, 'Buku ini bukan proyek Book Chapter.');

        $book->load(['chapters.manuscript.user.publicProfile', 'chapters.manuscript.revisions', 'compilation', 'ownerEditor']);
        $compilation = $book->compilation;

        abort_if(
            $compilation && ! in_array($compilation->status, self::RECOMPILABLE, true),
            422,
            'Naskah gabungan sedang direview atau sudah selesai, tidak bisa digabung ulang.'
        );

        $blockers = $this->blockers($book);
        abort_if($blockers !== [], 422, implode(' ', $blockers));

        $filled = $book->chapters->filter(fn (BookChapter $chapter) => $chapter->manuscript !== null)->values();
        $missing = $book->chapters->count() - $filled->count();

        abort_if(
            $missing > 0 && ! $allowMissing,
            422,
            "Masih ada {$missing} bab yang belum terisi naskah. Gabungkan tanpa bab tersebut?"
        );

        $inputs = $filled->map(fn (BookChapter $chapter) => [
            'path' => Storage::disk('local')->path($this->sourceRevision($chapter->manuscript)->file_path),
            'number' => (int) $chapter->chapter_number,
            'title' => (string) $chapter->title,
            'author' => $chapter->manuscript->user?->publicProfile?->pen_name ?: (string) $chapter->manuscript->user?->name,
        ])->all();

        $docx = (new DocxMerger)->merge($inputs);

        if ($template !== null) {
            $temp = tempnam(sys_get_temp_dir(), 'tpcomp').'.docx';
            file_put_contents($temp, $docx);

            try {
                $data = $this->autoLayout->compilationData(
                    $book,
                    $filled->map(fn (BookChapter $chapter) => $chapter->manuscript)->all(),
                    $compilation?->editor?->name ?? $book->ownerEditor?->name
                );
                $docx = $this->autoLayout->layoutFile($temp, $template, $data);
            } finally {
                @unlink($temp);
            }
        }

        return DB::transaction(function () use ($book, $admin, $template, $filled, $compilation, $docx) {
            $authors = $filled->map(fn (BookChapter $chapter) => $chapter->manuscript->user)->filter()->unique('id')->values();
            $isNew = $compilation === null;

            $compilation ??= Manuscript::create([
                'order_id' => null,
                'user_id' => $authors->first()->id,
                'title' => $book->title,
                'authors' => [],
                'status' => 'pending_editor_assignment',
                'compiled_book_id' => $book->id,
            ]);

            $compilation->update([
                'title' => $book->title,
                'authors' => $authors->map(fn (User $user) => $user->publicProfile?->pen_name ?: $user->name)->all(),
                'manuscript_template_id' => $template?->id ?? $compilation->manuscript_template_id,
            ]);

            // Penulis naskah gabungan = penulis tiap bab (review akhir bersama).
            $compilation->authorLinks()->whereNotIn('user_id', $authors->pluck('id'))->delete();

            foreach ($authors as $index => $user) {
                $compilation->authorLinks()->updateOrCreate(['user_id' => $user->id], ['position' => $index + 1, 'approved_at' => null]);
            }

            $path = 'manuscripts/'.$compilation->id.'/gabungan-'.Str::random(10).'.docx';
            Storage::disk('local')->put($path, $docx);

            $numbers = $filled->pluck('chapter_number');
            $compilation->revisions()->create([
                'revision_number' => ($compilation->revisions()->max('revision_number') ?? 0) + 1,
                'uploaded_by' => $admin->id,
                'role' => 'compilation',
                'file_path' => $path,
                'original_filename' => (Str::slug(Str::limit($book->title, 80, '')) ?: 'book-chapter').'-gabungan.docx',
                'note' => sprintf(
                    'Gabungan %d bab (BAB %s)%s',
                    $filled->count(),
                    $numbers->implode(', '),
                    $template ? ' — auto layout dengan template: '.$template->name : ''
                ),
                'admin_status' => 'approved',
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            if ($isNew && $book->owner_editor_id) {
                $compilation->update([
                    'status' => 'in_editing',
                    'editor_id' => $book->owner_editor_id,
                    'editor_source' => Manuscript::EDITOR_SOURCE_PROJECT_OWNER,
                    'editor_requested_fee' => null,
                    'editor_fee' => 0,
                ]);
            }

            foreach ($filled as $chapter) {
                if ($chapter->manuscript->status === Manuscript::STATUS_AWAITING_COMPILATION) {
                    $chapter->manuscript->update(['status' => Manuscript::STATUS_COMPILED]);
                }
            }

            return $compilation->fresh(['revisions', 'editor', 'authorLinks.user']);
        });
    }

    /**
     * Catatan revisi untuk satu bab: dikirim ke penulis bab itu, babnya
     * kembali berstatus "perlu revisi".
     */
    public function requestChapterRevision(Manuscript $compilation, Manuscript $chapterManuscript, User $by, string $note): ChapterRevisionRequest
    {
        $chapter = $this->chapterOf($chapterManuscript);

        abort_unless($chapter && $chapter->book_id === $compilation->compiled_book_id, 404, 'Bab ini bukan bagian dari naskah gabungan.');
        abort_if($compilation->status === 'completed', 422, 'Naskah gabungan sudah selesai.');
        abort_unless(
            in_array($chapterManuscript->status, [Manuscript::STATUS_COMPILED, Manuscript::STATUS_AWAITING_COMPILATION, 'revision_requested', 'completed'], true),
            422,
            'Bab ini sedang menunggu review admin atas revisi penulis.'
        );

        return DB::transaction(function () use ($compilation, $chapterManuscript, $by, $note) {
            $chapterManuscript->update(['status' => 'revision_requested']);

            return ChapterRevisionRequest::create([
                'compilation_id' => $compilation->id,
                'manuscript_id' => $chapterManuscript->id,
                'requested_by' => $by->id,
                'note' => $note,
            ]);
        });
    }

    /**
     * Naskah bab penulis disetujui admin: menunggu bab lain, atau langsung
     * "sudah digabung" kalau ini revisi atas catatan editor.
     */
    public function chapterApproved(Manuscript $chapterManuscript): void
    {
        $chapter = $this->chapterOf($chapterManuscript);
        $compilation = $chapter?->book?->compilation;
        $merged = $compilation !== null && $compilation->status !== 'completed';

        $chapterManuscript->update([
            'status' => $merged ? Manuscript::STATUS_COMPILED : Manuscript::STATUS_AWAITING_COMPILATION,
        ]);

        $chapterManuscript->chapterRevisionRequests()->whereNull('resolved_at')->update(['resolved_at' => now()]);
    }

    /** Naskah gabungan disetujui semua penulis → semua bab selesai. */
    public function compilationCompleted(Manuscript $compilation): void
    {
        $manuscriptIds = BookChapter::where('book_id', $compilation->compiled_book_id)
            ->whereNotNull('manuscript_id')
            ->pluck('manuscript_id');

        Manuscript::whereIn('id', $manuscriptIds)
            ->whereIn('status', [Manuscript::STATUS_AWAITING_COMPILATION, Manuscript::STATUS_COMPILED, 'revision_requested'])
            ->update(['status' => 'completed']);
    }

    /**
     * Berkas bab yang dipakai untuk digabung: revisi disetujui terbaru
     * (penulis; untuk bab alur lama bisa hasil editor).
     */
    public function sourceRevision(Manuscript $manuscript): ?ManuscriptRevision
    {
        return $manuscript->revisions
            ->where('admin_status', 'approved')
            ->whereIn('role', ['penulis', 'editor', 'layout'])
            ->sortByDesc('revision_number')
            ->first();
    }

    /** @return list<string> */
    private function blockers(Book $book): array
    {
        $messages = [];
        $filled = 0;

        foreach ($book->chapters as $chapter) {
            $manuscript = $chapter->manuscript;

            if (! $manuscript) {
                continue;
            }

            $filled++;
            $label = "BAB {$chapter->chapter_number}";

            if (! in_array($manuscript->status, self::READY_STATUSES, true)) {
                $messages[] = "{$label} belum disetujui admin.";

                continue;
            }

            $source = $this->sourceRevision($manuscript);

            if (! $source || ! Storage::disk('local')->exists($source->file_path)) {
                $messages[] = "{$label}: berkas naskah tidak ditemukan.";
            } elseif (! $this->isDocx($source)) {
                $messages[] = "{$label}: naskah harus berformat Word (.docx) agar bisa digabung.";
            }
        }

        if ($filled === 0) {
            $messages[] = 'Belum ada bab yang berisi naskah.';
        }

        return $messages;
    }

    private function isDocx(ManuscriptRevision $revision): bool
    {
        return strtolower(pathinfo((string) $revision->original_filename, PATHINFO_EXTENSION)) === 'docx';
    }
}
