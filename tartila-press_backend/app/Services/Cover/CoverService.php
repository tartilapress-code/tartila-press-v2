<?php

namespace App\Services\Cover;

use App\Models\Book;
use App\Models\Cover;
use App\Models\CoverEvent;
use App\Models\CoverProject;
use App\Models\CoverVote;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\User;
use App\Services\Notifier;
use App\Support\ResponsiveImages;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Cover khusus.
 *
 *  - Cover paket: begitu admin menyetujui hasil editing, naskah masuk tagihan cover. Admin mengunggah 3 pilihan;
 *    penulis memilih (lebih dari satu penulis = voting; waktu berunding 24 jam, lalu suara terbanyak dipakai).
 *    Penulis bisa mengirim catatan revisi (pada cover pilihannya) atau meminta dibuat ulang ("revisi semua").
 *    Cover terpilih yang punya catatan tetap direvisi admin lalu disetujui lagi. Cover yang disetujui = layak terbit
 *    dan dipakai sampai akhir.
 *  - Cover Book Chapter: sejak proyek dibuat admin boleh mengunggah SATU cover awal (tampil publik menggantikan
 *    cover bawaan). Pada masa tenggat admin menambah 2 pilihan lain; setelah naskah gabungan di-auto layout admin
 *    daftar pindah ke cover paket (mendesak) dan alurnya sama.
 *  - 7 hari setelah buku terbit berkas pilihan, revisi, dan dokumen revisi dihapus (riwayat tetap); tersisa
 *    ebook dan cover terakhir. Penulis diberi tahu agar mengunduh berkas yang diperlukan.
 */
class CoverService
{
    public const OPTION_COUNT = 3;

    /** Waktu berunding / voting (jam). */
    public const VOTING_HOURS = 24;

    /** Berkas dihapus setelah buku terbit selama ini (hari). */
    public const RETENTION_DAYS = 7;

    public function __construct(private readonly Notifier $notifier) {}

    // =====================================================================
    // Pembuatan proyek
    // =====================================================================

    /** Hasil editing disetujui admin: naskah paket masuk tagihan cover (sekali; tidak untuk bab/naskah gabungan). */
    public function openForManuscript(Manuscript $manuscript): ?CoverProject
    {
        $manuscript->loadMissing('bookChapter');

        if ($manuscript->bookChapter !== null || $manuscript->compiled_book_id !== null) {
            return null;
        }

        $project = CoverProject::where('manuscript_id', $manuscript->id)->first();

        if ($project) {
            return $project;
        }

        $project = CoverProject::create([
            'source' => 'package',
            'stage' => 'urgent',
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'status' => 'awaiting_upload',
        ]);

        $this->event($project, 'created');
        $this->notifier->guard(fn () => $this->notifier->notifyAdmins(
            'admin_cover',
            'Tagihan cover baru',
            $manuscript->title.' — unggah 3 pilihan cover.',
            '/admin/covers',
            ['subject_type' => 'cover_project', 'subject_id' => $project->id]
        ));

        return $project;
    }

    /** Proyek Book Chapter baru: judulnya langsung muncul di daftar cover Book Chapter (belum mendesak). */
    public function ensureChapterProject(Book $book): CoverProject
    {
        return CoverProject::firstOrCreate(
            ['book_id' => $book->id],
            ['source' => 'chapter', 'stage' => 'early', 'title' => $book->title, 'status' => 'awaiting_upload']
        );
    }

    /** Naskah gabungan sudah di-auto layout admin: cover pindah ke daftar cover paket dan mendesak. */
    public function chapterCompiled(Book $book, Manuscript $compilation): CoverProject
    {
        $project = $this->ensureChapterProject($book);

        if ($project->stage === 'urgent') {
            $project->update(['title' => $book->title, 'manuscript_id' => $compilation->id]);

            return $project;
        }

        $project->update(['stage' => 'urgent', 'manuscript_id' => $compilation->id, 'title' => $book->title]);

        $this->event($project, 'urgent');

        if ($project->status === 'awaiting_upload' && $project->currentCovers()->count() >= self::OPTION_COUNT) {
            $this->openVoting($project->fresh());
        } else {
            $this->notifier->guard(fn () => $this->notifier->notifyAdmins(
                'admin_cover',
                'Cover Book Chapter mendesak',
                $book->title.' — naskah gabungan siap; lengkapi 3 pilihan cover.',
                '/admin/covers',
                ['subject_type' => 'cover_project', 'subject_id' => $project->id]
            ));
        }

        return $project;
    }

    // =====================================================================
    // Unggah admin
    // =====================================================================

    /** Unggah / ganti satu pilihan cover pada ronde berjalan (posisi 1-3). */
    public function uploadOption(CoverProject $project, UploadedFile $file, int $position, User $admin): Cover
    {
        abort_if($position < 1 || $position > self::OPTION_COUNT, 422, 'Posisi cover harus 1 sampai 3.');
        abort_unless($project->status === 'awaiting_upload', 422, 'Pilihan cover tidak bisa diubah pada tahap ini.');

        $project->loadMissing('book');

        if ($project->source === 'chapter' && $project->stage === 'early') {
            $deadlinePassed = $project->book?->submission_deadline?->isPast() ?? false;

            // Sebelum tenggat hanya satu cover awal; pada masa tenggat 2 pilihan lain boleh ditambahkan.
            abort_if($position > 1 && ! $deadlinePassed, 422, 'Sebelum masa tenggat hanya satu cover awal. Pilihan lain diunggah saat tenggat.');
        }

        return DB::transaction(function () use ($project, $file, $position, $admin) {
            $existing = $project->covers()->where('round', $project->round)->where('position', $position)->first();

            if ($existing) {
                $this->deleteFiles($existing);
                $existing->delete();
            }

            $cover = Cover::create([
                'cover_project_id' => $project->id,
                'round' => $project->round,
                'position' => $position,
                'kind' => 'option',
                'file_path' => $this->store($project, $file, $project->round, $position),
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                'uploaded_by' => $admin->id,
            ]);

            $this->event($project, 'uploaded', "Cover {$position}", $admin);

            // Cover awal Book Chapter tampil publik menggantikan cover bawaan.
            if ($project->source === 'chapter' && $position === 1 && $project->round === 1 && $project->book) {
                $this->publish($cover, 'chapter');
                $project->book->forceFill(['front_cover' => $this->publicUrl($cover)])->save();
            }

            $project->load('covers');

            if ($project->stage === 'urgent' && $project->currentCovers()->count() >= self::OPTION_COUNT) {
                $this->openVoting($project);
            }

            return $cover;
        });
    }

    /** Admin mengunggah revisi cover terpilih (setelah penulis mengirim catatan). */
    public function uploadRevision(CoverProject $project, UploadedFile $file, User $admin): Cover
    {
        abort_unless($project->status === 'revision' && $project->chosen_cover_id, 422, 'Tidak ada cover yang menunggu revisi.');

        return DB::transaction(function () use ($project, $file, $admin) {
            $project->update(['round' => $project->round + 1]);

            $cover = Cover::create([
                'cover_project_id' => $project->id,
                'round' => $project->round,
                'position' => 1,
                'kind' => 'revision',
                'parent_cover_id' => $project->chosen_cover_id,
                'file_path' => $this->store($project, $file, $project->round, 1),
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                'uploaded_by' => $admin->id,
            ]);

            $this->event($project, 'revised', null, $admin);
            $this->openVoting($project->fresh(['covers']));

            return $cover;
        });
    }

    /** Hapus satu pilihan yang belum dipakai voting (ronde berjalan, belum dibuka). */
    public function deleteOption(Cover $cover): void
    {
        $project = $cover->project;

        abort_unless($project->status === 'awaiting_upload' && $cover->round === $project->round, 422, 'Cover ini tidak bisa dihapus lagi.');

        $this->deleteFiles($cover);
        $cover->delete();
    }

    /** Admin menetapkan pemenang (mis. tidak ada suara) lewat jalur yang sama dengan penutupan voting. */
    public function decide(CoverProject $project, Cover $cover, User $admin): CoverProject
    {
        abort_unless($project->status === 'voting', 422, 'Cover tidak sedang dalam pemungutan suara.');
        abort_unless($cover->cover_project_id === $project->id && $cover->round === $project->round, 422, 'Cover bukan pilihan ronde ini.');

        $this->event($project, 'decided', "Cover {$cover->position} ditetapkan admin", $admin);
        $this->finish($project, $cover->id);

        return $project->fresh();
    }

    // =====================================================================
    // Voting penulis
    // =====================================================================

    public function authors(CoverProject $project): Collection
    {
        $manuscript = $project->manuscript_id ? Manuscript::with('authorLinks.user')->find($project->manuscript_id) : null;

        return $manuscript ? $manuscript->authorLinks->pluck('user')->filter()->values() : collect();
    }

    public function vote(CoverProject $project, User $user, ?int $coverId, ?string $note): CoverVote
    {
        $this->tick($project);
        $project->refresh();

        abort_unless($project->status === 'voting', 422, 'Pemilihan cover sedang tidak dibuka.');
        abort_unless($this->authors($project)->contains('id', $user->id), 403, 'Hanya penulis buku ini yang bisa memilih cover.');

        if ($coverId !== null) {
            abort_unless($project->covers()->where('round', $project->round)->whereKey($coverId)->exists(), 422, 'Cover bukan pilihan ronde ini.');
        }

        $note = trim((string) $note);

        $vote = CoverVote::updateOrCreate(
            ['cover_project_id' => $project->id, 'round' => $project->round, 'user_id' => $user->id],
            ['cover_id' => $coverId, 'note' => $note === '' ? null : mb_substr($note, 0, 2000)]
        );

        $this->evaluate($project->fresh(), false);

        return $vote;
    }

    /** Tutup voting yang sudah lewat 24 jam (dan yang sudah bulat). */
    public function tick(CoverProject $project): void
    {
        if ($project->status === 'voting') {
            $this->evaluate($project, $project->voting_deadline_at?->isPast() ?? false);
        }
    }

    public function tickAll(): int
    {
        $count = 0;

        CoverProject::where('status', 'voting')->where('voting_deadline_at', '<=', now())->get()->each(function (CoverProject $project) use (&$count) {
            $before = $project->status;
            $this->evaluate($project, true);
            $count += $project->fresh()->status !== $before ? 1 : 0;
        });

        return $count;
    }

    /**
     * Tutup bila semua penulis sudah memilih hal yang sama, atau (final) waktunya habis dan ada suara.
     * Waktu habis tanpa satu pun suara: admin diberi tahu untuk menetapkan sendiri.
     */
    private function evaluate(CoverProject $project, bool $deadlinePassed): void
    {
        $votes = $project->votes()->where('round', $project->round)->get();
        $authorCount = max(1, $this->authors($project)->count());

        $unanimous = $votes->count() >= $authorCount && $votes->pluck('cover_id')->unique()->count() === 1;

        if ($unanimous) {
            $this->finish($project, $votes->first()->cover_id);

            return;
        }

        if (! $deadlinePassed) {
            return;
        }

        if ($votes->isEmpty()) {
            // Beri tahu admin sekali per ronde, perpanjang 24 jam supaya tidak berulang tiap menit.
            $project->update(['voting_deadline_at' => now()->addHours(self::VOTING_HOURS)]);
            $this->notifier->guard(fn () => $this->notifier->notifyAdmins('admin_cover', 'Cover belum dipilih penulis', $project->title.' — tidak ada suara; tetapkan cover.', '/admin/covers', ['subject_type' => 'cover_project', 'subject_id' => $project->id]));

            return;
        }

        $tally = $votes->groupBy(fn (CoverVote $vote) => (string) ($vote->cover_id ?? 'redo'))->map->count();
        $positions = $project->covers()->where('round', $project->round)->pluck('position', 'id');

        // Suara terbanyak; seri: cover (bukan "buat ulang") dengan nomor terkecil.
        $winner = $tally->keys()->sort(function ($a, $b) use ($tally, $positions) {
            return [$tally[$b], $b === 'redo' ? 0 : 1, -($positions[$b] ?? 99)] <=> [$tally[$a], $a === 'redo' ? 0 : 1, -($positions[$a] ?? 99)];
        })->first();

        $this->finish($project, $winner === 'redo' ? null : (int) $winner);
    }

    /** Hasil voting: buat ulang, revisi cover terpilih (ada catatan), atau disetujui. */
    private function finish(CoverProject $project, ?int $winnerId): void
    {
        $votes = $project->votes()->where('round', $project->round)->with('user:id,name')->get();

        if ($winnerId === null) {
            $notes = $votes->filter(fn ($vote) => $vote->note)->map(fn ($vote) => $vote->user?->name.': '.$vote->note)->implode(' | ');

            $project->update(['status' => 'awaiting_upload', 'round' => $project->round + 1, 'voting_opened_at' => null, 'voting_deadline_at' => null, 'chosen_cover_id' => null]);
            $this->event($project, 'redo', $notes ?: null);
            $this->notifier->guard(function () use ($project, $notes) {
                $this->notifier->notifyAdmins('admin_cover', 'Cover dibuat ulang', $project->title.($notes ? " — catatan penulis: {$notes}" : ''), '/admin/covers', ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
                $this->notifier->notify($this->authors($project), 'cover', 'Cover akan dibuat ulang', $project->title.' — admin menyiapkan 3 pilihan baru.', $this->authorLink($project), ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
            });

            return;
        }

        $notes = $votes->where('cover_id', $winnerId)->filter(fn ($vote) => filled($vote->note));
        $project->update(['chosen_cover_id' => $winnerId]);

        if ($notes->isNotEmpty()) {
            $project->update(['status' => 'revision']);
            $text = $notes->map(fn ($vote) => $vote->user?->name.': '.$vote->note)->implode(' | ');
            $this->event($project, 'revision_requested', $text);
            $this->notifier->guard(function () use ($project, $text) {
                $this->notifier->notifyAdmins('admin_cover', 'Cover perlu direvisi', $project->title." — {$text}", '/admin/covers', ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
                $this->notifier->notify($this->authors($project), 'cover', 'Cover terpilih akan direvisi', $project->title.' — admin merevisi cover sesuai catatan, lalu Anda diminta menyetujuinya.', $this->authorLink($project), ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
            });

            return;
        }

        $this->approve($project->fresh());
    }

    private function approve(CoverProject $project): void
    {
        $cover = Cover::findOrFail($project->chosen_cover_id);

        if (! $cover->public_path) {
            $this->publish($cover, 'final');
        }

        $project->update(['status' => 'approved', 'approved_at' => now()]);
        $this->event($project, 'approved', "Cover {$cover->position}");

        // Cover yang dipilih langsung dipakai pada buku (Book Chapter) atau saat naskah diterbitkan.
        $book = $project->book_id ? Book::withoutGlobalScopes()->find($project->book_id) : null;
        $book?->forceFill(['front_cover' => $this->publicUrl($cover)])->save();

        $this->notifier->guard(function () use ($project) {
            $this->notifier->notifyAdmins('admin_cover', 'Cover disetujui', $project->title.' — layak terbit.', '/admin/covers', ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
            $this->notifier->notify($this->authors($project), 'cover', 'Cover disetujui', $project->title.' — cover sudah final dan layak terbit.', $this->authorLink($project), ['subject_type' => 'cover_project', 'subject_id' => $project->id]);
        });
    }

    private function openVoting(CoverProject $project): void
    {
        $project->update([
            'status' => 'voting',
            'voting_opened_at' => now(),
            'voting_deadline_at' => now()->addHours(self::VOTING_HOURS),
        ]);

        $this->event($project, 'voting_opened');

        $this->notifier->guard(fn () => $this->notifier->notify(
            $this->authors($project),
            'cover',
            'Pilih cover buku Anda',
            $project->title.' — pilihan cover siap. Pilih dalam '.self::VOTING_HOURS.' jam (semua penulis berunding; suara terbanyak dipakai).',
            $this->authorLink($project),
            ['subject_type' => 'cover_project', 'subject_id' => $project->id]
        ));
    }

    // =====================================================================
    // Cover buku terbit & penghapusan berkas
    // =====================================================================

    /** Admin mengganti cover final buku terbit (cover terakhir yang dipakai). */
    public function replaceBookCover(Book $book, UploadedFile $file, User $admin): Book
    {
        $path = $file->store("uploads/covers/final/book-{$book->id}", 'public');
        app(ResponsiveImages::class)->generate($path);

        $book->forceFill(['front_cover' => Storage::disk('public')->url($path)])->save();

        CoverEvent::create(['book_id' => $book->id, 'action' => 'book_cover_replaced', 'user_id' => $admin->id]);

        return $book;
    }

    /** Buku aktif/terbit: tandai proyek cover, pakai cover final, beri tahu penulis soal penghapusan berkas. */
    public function bookPublished(Book $book): void
    {
        $project = CoverProject::where('book_id', $book->id)
            ->orWhere(fn ($query) => $query->where('manuscript_id', $book->manuscript_id)->whereNotNull('manuscript_id'))
            ->first();

        if (! $project || $project->published_at) {
            return;
        }

        $project->update(['book_id' => $project->book_id ?? $book->id, 'published_at' => now()]);

        if ($project->status === 'approved' && $project->chosen_cover_id) {
            $cover = Cover::find($project->chosen_cover_id);
            $cover?->public_path && $book->forceFill(['front_cover' => $this->publicUrl($cover)])->saveQuietly();
        }

        $this->event($project, 'published');

        $until = now()->addDays(self::RETENTION_DAYS)->translatedFormat('j F Y');
        $this->notifier->guard(fn () => $this->notifier->notify(
            $this->authors($project),
            'cover',
            'Buku terbit — unduh berkas yang diperlukan',
            $project->title." sudah terbit. Pilihan cover, revisi cover, dan dokumen revisi akan dihapus dari sistem pada {$until} (tersisa riwayat, ebook, dan cover terakhir). Unduh sekarang bila diperlukan.",
            $this->authorLink($project),
            ['subject_type' => 'cover_project', 'subject_id' => $project->id]
        ));
    }

    /** Pengingat sehari sebelum berkas dihapus. */
    public function warnDue(): int
    {
        $count = 0;

        CoverProject::whereNotNull('published_at')->whereNull('purge_warned_at')->whereNull('files_purged_at')
            ->where('published_at', '<=', now()->subDays(self::RETENTION_DAYS - 1))
            ->get()->each(function (CoverProject $project) use (&$count) {
                $project->update(['purge_warned_at' => now()]);
                $this->notifier->guard(fn () => $this->notifier->notify($this->authors($project), 'cover', 'Berkas cover & revisi dihapus besok', $project->title.' — unduh berkas yang masih Anda perlukan sekarang.', $this->authorLink($project), ['subject_type' => 'cover_project', 'subject_id' => $project->id]));
                $count++;
            });

        return $count;
    }

    /** Hapus berkas pilihan/revisi cover dan dokumen revisi buku yang sudah terbit 7 hari; riwayat tetap. */
    public function purgeDue(): int
    {
        $count = 0;

        CoverProject::whereNotNull('published_at')->whereNull('files_purged_at')
            ->where('published_at', '<=', now()->subDays(self::RETENTION_DAYS))
            ->get()->each(function (CoverProject $project) use (&$count) {
                $this->purge($project);
                $count++;
            });

        return $count;
    }

    public function purge(CoverProject $project): void
    {
        DB::transaction(function () use ($project) {
            $project->covers()->whereNull('purged_at')->get()->each(function (Cover $cover) {
                $this->deleteFiles($cover, keepPublic: true);
                $cover->update(['file_path' => null, 'purged_at' => now()]);
            });

            $manuscriptIds = collect([$project->manuscript_id]);

            if ($project->book_id) {
                $book = Book::withoutGlobalScopes()->with('chapters:id,book_id,manuscript_id')->find($project->book_id);
                $manuscriptIds = $manuscriptIds->merge($book?->chapters->pluck('manuscript_id') ?? []);
            }

            ManuscriptRevision::whereIn('manuscript_id', $manuscriptIds->filter())->whereNotNull('file_path')->get()->each(function ($revision) {
                Storage::disk('local')->delete($revision->file_path);
                $revision->update(['file_path' => null, 'file_purged_at' => now()]);
            });

            $project->update(['files_purged_at' => now()]);
            $this->event($project, 'purged');
        });
    }

    // =====================================================================
    // Tampilan
    // =====================================================================

    /** @return array<string, mixed> */
    public function state(CoverProject $project, ?User $viewer = null, bool $admin = false): array
    {
        $project->load(['covers', 'events.user:id,name', 'book']);
        $authors = $this->authors($project);
        $votes = $project->votes()->where('round', $project->round)->with('user:id,name')->get();
        $mine = $viewer ? $votes->firstWhere('user_id', $viewer->id) : null;

        return [
            'id' => $project->id,
            'source' => $project->source,
            'stage' => $project->stage,
            'title' => $project->title,
            'status' => $project->status,
            'round' => $project->round,
            'manuscript_id' => $project->manuscript_id,
            'book_id' => $project->book_id,
            'voting_opened_at' => $project->voting_opened_at?->toIso8601String(),
            'voting_deadline_at' => $project->voting_deadline_at?->toIso8601String(),
            'option_count' => self::OPTION_COUNT,
            'options' => $project->covers->map(fn (Cover $cover) => [
                'id' => $cover->id,
                'round' => $cover->round,
                'position' => $cover->position,
                'kind' => $cover->kind,
                'current' => $cover->round === $project->round,
                'chosen' => $cover->id === $project->chosen_cover_id,
                'purged' => $cover->purged_at !== null,
                'name' => $cover->original_name,
                'public_url' => $cover->public_path ? $this->publicUrl($cover) : null,
            ])->values(),
            'authors' => $authors->map(fn (User $author) => [
                'id' => $author->id,
                'name' => $author->name,
                'voted' => $votes->contains('user_id', $author->id),
            ])->values(),
            'votes' => $votes->map(fn (CoverVote $vote) => [
                'user_id' => $vote->user_id,
                'name' => $vote->user?->name,
                'cover_id' => $vote->cover_id,
                'note' => $vote->note,
            ])->values(),
            'my_vote' => $mine ? ['cover_id' => $mine->cover_id, 'note' => $mine->note] : null,
            'is_author' => $viewer ? $authors->contains('id', $viewer->id) : false,
            'can_vote' => $project->status === 'voting' && $viewer && $authors->contains('id', $viewer->id),
            'chosen_cover_id' => $project->chosen_cover_id,
            'approved_at' => $project->approved_at?->toIso8601String(),
            'published_at' => $project->published_at?->toIso8601String(),
            'purge_at' => $project->published_at?->copy()->addDays(self::RETENTION_DAYS)->toIso8601String(),
            'files_purged' => $project->files_purged_at !== null,
            'front_cover' => $project->book?->front_cover,
            'history' => $project->events->map(fn (CoverEvent $event) => [
                'action' => $event->action,
                'note' => $event->note,
                'by' => $event->user?->name,
                'created_at' => $event->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    // =====================================================================
    // Berkas
    // =====================================================================

    private function store(CoverProject $project, UploadedFile $file, int $round, int $position): string
    {
        return $file->storeAs(
            "covers/{$project->id}",
            "r{$round}-p{$position}-".bin2hex(random_bytes(8)).'.'.strtolower($file->getClientOriginalExtension()),
            'local'
        );
    }

    /** Salinan publik (dengan varian kecil) untuk cover yang dipakai di buku. */
    private function publish(Cover $cover, string $folder): void
    {
        $extension = pathinfo((string) $cover->file_path, PATHINFO_EXTENSION);
        $path = "uploads/covers/{$folder}/{$cover->cover_project_id}/".bin2hex(random_bytes(8)).'.'.$extension;

        Storage::disk('public')->put($path, Storage::disk('local')->get($cover->file_path));
        app(ResponsiveImages::class)->generate($path);

        $cover->update(['public_path' => $path]);
    }

    public function publicUrl(Cover $cover): string
    {
        return Storage::disk('public')->url($cover->public_path);
    }

    private function deleteFiles(Cover $cover, bool $keepPublic = false): void
    {
        if ($cover->file_path) {
            Storage::disk('local')->delete($cover->file_path);
        }

        if (! $keepPublic && $cover->public_path) {
            Storage::disk('public')->delete($cover->public_path);
        }
    }

    private function authorLink(CoverProject $project): string
    {
        return $project->manuscript_id ? "/dashboard/naskah/{$project->manuscript_id}" : '/dashboard';
    }

    private function event(CoverProject $project, string $action, ?string $note = null, ?User $by = null): void
    {
        CoverEvent::create(['cover_project_id' => $project->id, 'action' => $action, 'note' => $note, 'user_id' => $by?->id]);
    }
}
