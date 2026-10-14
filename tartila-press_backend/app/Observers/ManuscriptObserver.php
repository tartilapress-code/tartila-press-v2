<?php

namespace App\Observers;

use App\Models\BookChapter;
use App\Models\ChapterRevisionRequest;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\User;
use App\Services\ManuscriptAssignmentService;
use App\Services\ManuscriptPoolService;
use App\Services\MouService;
use App\Services\NotificationLedger;
use App\Services\Notifier;
use Illuminate\Support\Collection;

/**
 * Update naskah → notifikasi + EMAIL ke penulis (semua penulis naskah) dan
 * editornya; admin mendapat notifikasi di aplikasi untuk naskah yang
 * menunggu tindakannya.
 */
class ManuscriptObserver
{
    public bool $afterCommit = true;

    public function __construct(private readonly Notifier $notifier) {}

    private function ledger(): NotificationLedger
    {
        return app(NotificationLedger::class);
    }

    public function created(Manuscript $manuscript): void
    {
        $this->notifier->guard(fn () => $this->handleCreated($manuscript));
    }

    private function handleCreated(Manuscript $manuscript): void
    {
        $this->statusChanged($manuscript, null);
    }

    public function updated(Manuscript $manuscript): void
    {
        $this->notifier->guard(fn () => $this->handleUpdated($manuscript));
    }

    private function handleUpdated(Manuscript $manuscript): void
    {
        if ($manuscript->wasChanged('status')) {
            $this->statusChanged($manuscript, $manuscript->getPrevious()['status'] ?? null);

            // MOU distribusi buku: naskah selesai (paket biasa) / naskah
            // gabungan masuk review akhir (Book Chapter).
            $this->notifier->guard(fn () => match (true) {
                $manuscript->compiled_book_id !== null && $manuscript->status === 'pending_penulis_review' => app(MouService::class)->forCompilation($manuscript),
                $manuscript->compiled_book_id === null && $manuscript->status === 'completed' => app(MouService::class)->forManuscript($manuscript),
                default => null,
            });
        }

        if ($manuscript->wasChanged('open_for_claim') && $manuscript->open_for_claim && $this->ledger()->once("pool:{$manuscript->id}")) {
            // Hanya editor yang memenuhi kriteria bidang naskah ini.
            $this->notifier->notify(
                app(ManuscriptPoolService::class)->eligibleEditors($manuscript)
                    ->reject(fn (User $editor) => $editor->id === $manuscript->coauthor_id),
                'pool',
                'Naskah baru tersedia di pool',
                $manuscript->title,
                '/dashboard/pool-naskah',
                ['subject_type' => 'manuscript', 'subject_id' => $manuscript->id]
            );
        }

        if ($manuscript->wasChanged('coauthor_open_for_claim') && $manuscript->coauthor_open_for_claim && $this->ledger()->once("coauthor-pool:{$manuscript->id}")) {
            // Hanya editor ber-centang co-author yang memenuhi kriteria bidang.
            $this->notifier->notify(
                app(ManuscriptAssignmentService::class)->eligibleCoauthors($manuscript),
                'coauthor_pool',
                'Naskah baru tersedia di pool co-author',
                $manuscript->title,
                '/dashboard/pool-coauthor',
                ['subject_type' => 'manuscript', 'subject_id' => $manuscript->id]
            );
        }
    }

    private function statusChanged(Manuscript $manuscript, ?string $from): void
    {
        if (! $this->ledger()->once("manuscript:{$manuscript->id}:{$manuscript->status}")) {
            return;
        }

        // Muat ulang (bukan loadMissing): relasi editor/co-author bisa sudah termuat sebagai null sebelum
        // penugasan (mis. auto layout memuatnya), sehingga editor yang baru ditugaskan tidak diberi tahu.
        $manuscript->load(['authorLinks.user', 'user', 'editor', 'coauthor']);

        $title = $manuscript->title;
        $link = "/dashboard/naskah/{$manuscript->id}";
        $subject = ['subject_type' => 'manuscript', 'subject_id' => $manuscript->id];
        $authors = $this->authors($manuscript);
        $editor = $manuscript->editor;
        $editorName = $editor?->name ?? 'editor';
        $coauthor = $manuscript->coauthor;
        $coauthorName = $coauthor?->name ?? 'co-author';
        // Fase co-author: yang meninjau hasil susunan hanya penulis aslinya, bukan co-author.
        $mainAuthors = $manuscript->authorLinks->where('is_coauthor', false)->pluck('user')->filter()->values();

        $toAuthors = fn (string $heading, string $body) => $this->notifier->notify(
            $authors, 'manuscript', $heading, "{$title} — {$body}", $link,
            $subject + ['email' => true, 'email_lines' => ["Naskah: {$title}", $body]]
        );
        $toEditor = fn (string $heading, string $body) => $this->notifier->notify(
            $editor, 'assigned_manuscript', $heading, "{$title} — {$body}", $link,
            $subject + ['email' => true, 'email_lines' => ["Naskah: {$title}", $body]]
        );
        $toMainAuthors = fn (string $heading, string $body) => $this->notifier->notify(
            $mainAuthors, 'manuscript', $heading, "{$title} — {$body}", $link,
            $subject + ['email' => true, 'email_lines' => ["Naskah: {$title}", $body]]
        );
        $toCoauthor = fn (string $heading, string $body) => $this->notifier->notify(
            $coauthor, 'coauthor_manuscript', $heading, "{$title} — {$body}", $link,
            $subject + ['email' => true, 'email_lines' => ["Naskah: {$title}", $body]]
        );
        $toAdmins = fn (string $heading) => $this->notifier->notifyAdmins('admin_manuscript', $heading, $title, $link, $subject);

        switch ($manuscript->status) {
            case 'submitted':
                $toAdmins($from === null ? 'Naskah baru menunggu review' : 'Revisi penulis menunggu review');
                $toAuthors(
                    $from === null ? 'Naskah diterima' : 'Revisi naskah diterima',
                    'Naskah sudah kami terima dan sedang diperiksa admin.'
                );
                break;

            case 'revision_requested':
                $request = ChapterRevisionRequest::where('manuscript_id', $manuscript->id)->whereNull('resolved_at')->latest('id')->first();

                if ($request) {
                    $toAuthors('Editor meminta revisi bab Anda', 'Catatan editor: '.$request->note);
                } else {
                    $note = $this->latestNote($manuscript, 'penulis');
                    $toAuthors('Naskah perlu direvisi', $note ? "Catatan admin: {$note}" : 'Silakan perbaiki naskah lalu unggah revisi.');
                }
                break;

            case ManuscriptAssignmentService::STATUS_PENDING_COAUTHOR_ASSIGNMENT:
                $toMainAuthors('Naskah disetujui admin', 'Naskah disetujui dan menunggu penugasan co-author.');
                $toAdmins('Naskah menunggu penugasan co-author');
                break;

            case ManuscriptAssignmentService::STATUS_IN_COAUTHORING:
                if ($from === ManuscriptAssignmentService::STATUS_PENDING_AUTHOR_REVIEW_COAUTHOR) {
                    $note = $this->latestNote($manuscript, 'coauthor', 'author_note');
                    $toCoauthor('Penulis meminta revisi susunan', $note ? "Catatan penulis: {$note}" : 'Penulis meminta perbaikan susunan naskah.');
                    break;
                }

                $toCoauthor('Naskah baru ditugaskan kepada Anda', 'Anda menjadi co-author naskah ini. Silakan mulai menyusun naskah.');
                $toMainAuthors('Naskah sedang disusun co-author', "Naskah sedang disusun oleh {$coauthorName}. Nama co-author dicantumkan sebagai penulis terakhir.");
                break;

            case ManuscriptAssignmentService::STATUS_PENDING_ADMIN_REVIEW_COAUTHOR:
                $toAdmins('Hasil co-author menunggu review');
                break;

            case ManuscriptAssignmentService::STATUS_COAUTHOR_REVISION_REQUESTED:
                $note = $this->latestNote($manuscript, 'coauthor');
                $toCoauthor('Hasil susunan perlu direvisi', $note ? "Catatan admin: {$note}" : 'Silakan perbaiki hasil susunan lalu unggah lagi.');
                break;

            case ManuscriptAssignmentService::STATUS_PENDING_AUTHOR_REVIEW_COAUTHOR:
                $toMainAuthors('Hasil susunan co-author siap direview', 'Silakan periksa hasil susunan lalu setujui atau minta revisi.');
                $toCoauthor('Hasil susunan disetujui admin', 'Hasil susunan Anda disetujui admin dan sedang ditinjau penulis.');
                break;

            case 'pending_editor_assignment':
                if ($manuscript->isCompilation()) {
                    $toAuthors('Naskah semua bab sudah digabung', 'Naskah semua bab sudah digabung menjadi satu buku dan menunggu penugasan editor.');
                } else {
                    $toAuthors('Naskah disetujui admin', 'Naskah disetujui dan sedang menunggu penugasan editor.');
                }

                $toAdmins('Naskah menunggu penugasan editor');
                break;

            case 'in_editing':
                if ($from === 'pending_penulis_review') {
                    $note = $this->latestNote($manuscript, null, 'author_note');
                    $toEditor('Penulis meminta revisi lagi', $note ? "Catatan penulis: {$note}" : 'Penulis meminta perbaikan tambahan.');
                    break;
                }

                $toEditor('Naskah baru ditugaskan kepada Anda', 'Silakan mulai mengedit naskah ini.');
                $toAuthors(
                    $manuscript->isCompilation() ? 'Naskah semua bab sudah digabung' : 'Naskah sedang diedit',
                    $manuscript->isCompilation()
                        ? "Naskah semua bab sudah digabung menjadi satu buku dan sedang diedit oleh {$editorName}."
                        : "Naskah sedang diedit oleh {$editorName}."
                );
                break;

            case 'pending_admin_review_editor':
                $toAdmins('Hasil editor menunggu review');
                break;

            case 'editor_revision_requested':
                $note = $this->latestNote($manuscript, 'editor');
                $toEditor('Hasil edit perlu direvisi', $note ? "Catatan admin: {$note}" : 'Silakan perbaiki hasil edit lalu unggah lagi.');
                break;

            case 'pending_penulis_review':
                $toAuthors('Hasil edit siap direview', 'Silakan periksa hasil edit lalu setujui atau minta revisi.');
                $toEditor('Hasil edit disetujui admin', 'Hasil edit Anda disetujui admin dan sedang direview penulis.');
                break;

            case 'completed':
                $toAuthors('Naskah selesai', 'Semua penulis sudah menyetujui hasil edit. Naskah selesai.');
                $toEditor('Naskah selesai', 'Penulis sudah menyetujui hasil edit Anda. Naskah selesai.');
                $toCoauthor('Naskah selesai', 'Naskah yang Anda susun sudah selesai. Anda tercatat sebagai penulis terakhir.');
                break;

            case Manuscript::STATUS_AWAITING_COMPILATION:
                $toAuthors('Bab disetujui admin', 'Naskah bab disetujui dan menunggu bab lain terkumpul sebelum digabung menjadi satu buku.');
                break;

            case Manuscript::STATUS_COMPILED:
                if ($from === 'submitted') {
                    $toAuthors('Revisi bab disetujui', 'Revisi bab disetujui admin dan diteruskan ke editor.');
                    $this->tellCompilationEditor($manuscript);
                } else {
                    $toAuthors('Bab sudah digabung', 'Naskah bab sudah digabung ke naskah buku dan sedang dikerjakan editor.');
                }
                break;
        }
    }

    /** Editor naskah gabungan: ada revisi bab baru yang bisa dipakai. */
    private function tellCompilationEditor(Manuscript $chapterManuscript): void
    {
        $chapter = BookChapter::with('book.compilation.editor')->where('manuscript_id', $chapterManuscript->id)->first();
        $compilation = $chapter?->book?->compilation;

        if (! $compilation?->editor) {
            return;
        }

        $body = "BAB {$chapter->chapter_number} ({$chapterManuscript->user?->name}) mengirim revisi yang sudah disetujui admin.";

        $this->notifier->notify(
            $compilation->editor,
            'assigned_manuscript',
            'Revisi bab tersedia',
            "{$compilation->title} — {$body}",
            "/dashboard/naskah/{$compilation->id}",
            ['subject_type' => 'manuscript', 'subject_id' => $compilation->id, 'email' => true, 'email_lines' => ["Naskah: {$compilation->title}", $body]]
        );
    }

    /** @return Collection<int, User> */
    private function authors(Manuscript $manuscript): Collection
    {
        $users = $manuscript->authorLinks->pluck('user')->filter()->values();

        return $users->isEmpty() && $manuscript->user ? collect([$manuscript->user]) : $users;
    }

    /** Catatan terakhir pada revisi ($column: admin_note atau author_note) dari peran tertentu. */
    private function latestNote(Manuscript $manuscript, ?string $role, string $column = 'admin_note'): ?string
    {
        $query = ManuscriptRevision::where('manuscript_id', $manuscript->id)->whereNotNull($column);

        if ($role !== null) {
            $query->where('role', $role);
        }

        $note = trim((string) $query->orderByDesc('revision_number')->value($column));

        return $note === '' ? null : $note;
    }
}
