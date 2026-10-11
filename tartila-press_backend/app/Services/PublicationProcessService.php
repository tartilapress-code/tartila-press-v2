<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\CustomPackageItem;
use App\Models\HkiRecord;
use App\Models\IsbnApplication;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\PublicationProcess;
use App\Models\PublicationProcessEvent;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Riwayat status proses penerbitan sesudah naskah selesai:
 * - Terbitkan Naskah: surat keaslian karya → pengajuan ISBN (resi
 *   Perpusnas) → ISBN ditolak (catatan) / ISBN terbit;
 * - HAKI (bila ada di paket): pengajuan → terbit (dari halaman HKI admin);
 * - Buku fisik (bila ada di paket): dicetak → dikirim → sampai.
 * Proses selesai setelah ISBN terbit, ditambah HAKI dan buku fisik bila
 * keduanya termasuk paket.
 *
 * Subjek proses sama dengan HKI: pesanan paket ("order") untuk naskah
 * biasa, atau buku ("book") untuk proyek Book Chapter.
 */
class PublicationProcessService
{
    /** Teks fasilitas/layanan yang berarti buku cetak untuk penulis (bukan "ISBN buku cetak"). */
    private const PHYSICAL_PATTERN = '/(eksemplar|\beks\b|buku\s*fisik|cetak)/i';

    public function __construct(
        private readonly FinanceService $finance,
        private readonly Notifier $notifier,
    ) {}

    // =====================================================================
    // Subjek
    // =====================================================================

    /** @return array{0: string, 1: int}|null */
    public function subjectForManuscript(Manuscript $manuscript): ?array
    {
        $manuscript->loadMissing('bookChapter');

        return match (true) {
            $manuscript->bookChapter !== null => ['book', $manuscript->bookChapter->book_id],
            $manuscript->compiled_book_id !== null => ['book', $manuscript->compiled_book_id],
            $manuscript->order_id !== null => ['order', $manuscript->order_id],
            default => null,
        };
    }

    /** @return array{0: string, 1: int}|null */
    public function subjectForApplication(IsbnApplication $application): ?array
    {
        if ($application->type === IsbnApplication::TYPE_CHAPTER) {
            return $application->book_id ? ['book', $application->book_id] : null;
        }

        return $application->manuscript ? $this->subjectForManuscript($application->manuscript) : null;
    }

    /** @return array{0: string, 1: int} */
    public function subjectForBook(Book $book): array
    {
        $book->loadMissing('manuscript');

        $isProject = $book->is_chapter_offering || $book->is_chapter_compilation || $book->chapters()->exists();

        return ! $isProject && $book->manuscript?->order_id
            ? ['order', $book->manuscript->order_id]
            : ['book', $book->id];
    }

    public function processFor(string $type, int $id): PublicationProcess
    {
        return PublicationProcess::firstOrCreate(['subject_type' => $type, 'subject_id' => $id]);
    }

    // =====================================================================
    // Progres
    // =====================================================================

    /**
     * Progres untuk halaman Naskah Saya; null bila naskah belum sampai tahap
     * penerbitan (naskah belum selesai / naskah gabungan bab belum selesai).
     *
     * @return array<string, mixed>|null
     */
    public function progressForManuscript(Manuscript $manuscript): ?array
    {
        $subject = $this->subjectForManuscript($manuscript);

        if (! $subject || ! $this->reachedPublishing($manuscript, $subject)) {
            return null;
        }

        return $this->progress(...$subject);
    }

    /** @return array<string, mixed> */
    public function progress(string $type, int $id): array
    {
        [$order, $book, $application] = $this->context($type, $id);
        $process = PublicationProcess::with('events')
            ->where('subject_type', $type)->where('subject_id', $id)->first();
        $events = $process?->events ?? collect();
        $lastEvent = fn (string $stage) => $events->where('stage', $stage)->last()?->created_at;

        $hki = $this->hkiRecord($type, $id, $book);
        $hkiIncluded = $hki !== null || $this->includesHki($type, $order, $book);
        $physicalAuto = $this->includesPhysicalAuto($type, $order, $book);
        $physicalIncluded = $process?->includes_physical ?? $physicalAuto;

        // --- Terbitkan Naskah ---------------------------------------------
        $signerRole = $type === 'book' ? 'editor' : 'penulis';
        $letterDone = $application?->is_signed ?? false;
        $isbnNumber = $book?->isbn ?: $process?->isbn_number;
        $isbnStatus = $process?->isbn_status;
        $published = $isbnStatus === PublicationProcess::ISBN_PUBLISHED || filled($book?->isbn);
        $submitted = $published || in_array($isbnStatus, [PublicationProcess::ISBN_SUBMITTED, PublicationProcess::ISBN_REJECTED], true);
        $rejected = ! $published && $isbnStatus === PublicationProcess::ISBN_REJECTED;

        $isbnSteps = [
            $this->step(
                'letter',
                $letterDone ? 'Surat Keaslian Karya ditandatangani' : "Menunggu Surat Keaslian Karya dari {$signerRole}",
                $letterDone ? 'done' : 'current',
                $application?->signed_at,
            ),
            $this->step('isbn_submitted', 'Pengajuan ISBN', $submitted ? 'done' : ($letterDone ? 'current' : 'pending'), $process?->isbn_submitted_at, [
                'receipt' => $process?->isbn_receipt,
                'tracking_url' => PublicationProcess::ISBN_TRACKING_URL,
            ]),
        ];

        if ($rejected) {
            $isbnSteps[] = $this->step('isbn_rejected', 'ISBN ditolak', 'rejected', $process->isbn_rejected_at, [
                'note' => $process->isbn_note,
            ]);
        }

        $isbnSteps[] = $this->step('isbn_published', 'ISBN terbit', $published ? 'done' : 'pending', $process?->isbn_published_at, [
            'isbn' => $published ? $isbnNumber : null,
        ]);

        // Pengajuan sedang berjalan = langkah aktif.
        if ($submitted && ! $published && ! $rejected) {
            $isbnSteps[count($isbnSteps) - 1]['state'] = 'current';
        }

        // --- HAKI ---------------------------------------------------------
        $hkiStatus = $hki?->status ?? 'pending';
        $hkiRegistered = $hkiStatus === 'registered';
        $hkiSubmitted = $hkiRegistered || $hkiStatus === 'submitted';
        $hkiSteps = [
            $this->step('hki_submitted', 'Pengajuan HAKI', $hkiSubmitted ? 'done' : 'current', $lastEvent('hki_submitted'), [
                'application_number' => $hki?->application_number,
            ]),
            $this->step('hki_registered', 'HAKI terbit', $hkiRegistered ? 'done' : ($hkiSubmitted ? 'current' : 'pending'),
                $lastEvent('hki_registered') ?? $hki?->registered_at, [
                    'registration_number' => $hki?->registration_number,
                    'has_certificate' => (bool) $hki?->hasCertificate(),
                ]),
        ];

        // --- Buku fisik -----------------------------------------------------
        $physicalIndex = array_search($process?->physical_status, PublicationProcess::PHYSICAL_STEPS, true);
        $physicalIndex = $physicalIndex === false ? -1 : $physicalIndex;
        $labels = ['printed' => 'Buku dicetak', 'shipped' => 'Buku dikirim', 'delivered' => 'Buku sampai'];
        $physicalSteps = [];

        foreach (PublicationProcess::PHYSICAL_STEPS as $index => $step) {
            $physicalSteps[] = $this->step($step, $labels[$step],
                $index <= $physicalIndex ? 'done' : ($index === $physicalIndex + 1 ? 'current' : 'pending'),
                $process?->{"{$step}_at"});
        }

        $sections = [
            ['key' => 'isbn', 'title' => 'Terbitkan Naskah', 'included' => true, 'steps' => $isbnSteps],
            ['key' => 'hki', 'title' => 'HAKI', 'included' => $hkiIncluded, 'steps' => $hkiSteps],
            ['key' => 'physical', 'title' => 'Buku Fisik', 'included' => $physicalIncluded, 'steps' => $physicalSteps,
                'note' => $process?->physical_note],
        ];

        // Tahap yang termasuk paket saja yang harus tuntas.
        $done = $published
            && (! $hkiIncluded || $hkiRegistered)
            && (! $physicalIncluded || $physicalIndex === count(PublicationProcess::PHYSICAL_STEPS) - 1);

        $finishTimes = collect([$process?->isbn_published_at])
            ->when($hkiIncluded, fn ($times) => $times->push($lastEvent('hki_registered') ?? $hki?->registered_at))
            ->when($physicalIncluded, fn ($times) => $times->push($process?->delivered_at))
            ->filter();

        return [
            'subject' => "{$type}:{$id}",
            'title' => $book?->title ?? $application?->title ?? $order?->manuscript?->title,
            'completed' => $done,
            'completed_at' => $done ? $finishTimes->max()?->toIso8601String() : null,
            'current' => $done ? 'Proses selesai' : $this->currentLabel($sections),
            'sections' => $sections,
            'includes' => [
                'hki' => $hkiIncluded,
                'physical' => $physicalIncluded,
                'physical_auto' => $physicalAuto,
                'physical_override' => $process?->includes_physical,
            ],
            'history' => $this->history($application, $events),
        ];
    }

    // =====================================================================
    // Aksi admin / penulis
    // =====================================================================

    public function submitIsbn(PublicationProcess $process, string $receipt, ?string $note, User $by): void
    {
        $process->update([
            'isbn_status' => PublicationProcess::ISBN_SUBMITTED,
            'isbn_receipt' => $receipt,
            'isbn_note' => null,
            'isbn_submitted_at' => now(),
            'isbn_rejected_at' => null,
            'updated_by' => $by->id,
        ]);

        $this->log($process, 'isbn_submitted', $note ? "Resi {$receipt}. {$note}" : "Resi {$receipt}", $by, true);
    }

    public function rejectIsbn(PublicationProcess $process, string $note, User $by): void
    {
        $process->update([
            'isbn_status' => PublicationProcess::ISBN_REJECTED,
            'isbn_note' => $note,
            'isbn_rejected_at' => now(),
            'updated_by' => $by->id,
        ]);

        $this->log($process, 'isbn_rejected', $note, $by, true);
    }

    public function publishIsbn(PublicationProcess $process, string $isbn, ?string $note, User $by): void
    {
        DB::transaction(function () use ($process, $isbn, $by) {
            $process->update([
                'isbn_status' => PublicationProcess::ISBN_PUBLISHED,
                'isbn_number' => $isbn,
                'isbn_note' => null,
                'isbn_published_at' => now(),
                'isbn_submitted_at' => $process->isbn_submitted_at ?? now(),
                'updated_by' => $by->id,
            ]);

            // Nomor ISBN ikut tercatat di data buku.
            [, $book] = $this->context($process->subject_type, $process->subject_id);
            $book?->update(['isbn' => $isbn]);
        });

        $this->log($process, 'isbn_published', $note ? "ISBN {$isbn}. {$note}" : "ISBN {$isbn}", $by, true);
    }

    /** Tahap buku fisik; mundur (koreksi admin) menghapus tanggal tahap sesudahnya. */
    public function setPhysical(PublicationProcess $process, ?string $step, ?string $note, User $by): void
    {
        $target = $step === null ? -1 : (int) array_search($step, PublicationProcess::PHYSICAL_STEPS, true);
        $current = array_search($process->physical_status, PublicationProcess::PHYSICAL_STEPS, true);
        $current = $current === false ? -1 : $current;
        $changes = ['physical_status' => $step, 'updated_by' => $by->id];

        if ($note !== null) {
            $changes['physical_note'] = $note;
        }

        foreach (PublicationProcess::PHYSICAL_STEPS as $index => $name) {
            if ($index > $target) {
                $changes["{$name}_at"] = null;
            } elseif ($process->{"{$name}_at"} === null) {
                $changes["{$name}_at"] = now();
            }
        }

        $process->update($changes);

        // Riwayat hanya untuk tahap yang maju.
        foreach (PublicationProcess::PHYSICAL_STEPS as $index => $name) {
            if ($index > $current && $index <= $target) {
                $this->log($process, $name, $index === $target ? $note : null, $by, $name !== 'printed');
            }
        }
    }

    /** Status HKI berubah di halaman HKI admin → masuk riwayat proses. */
    public function recordHki(HkiRecord $record, ?string $previousStatus, ?User $by): void
    {
        if ($record->status === $previousStatus || ! in_array($record->status, ['submitted', 'registered'], true)) {
            return;
        }

        $subject = $record->subject_type === 'book'
            ? (($book = Book::find($record->subject_id)) ? $this->subjectForBook($book) : null)
            : ['order', $record->subject_id];

        if (! $subject) {
            return;
        }

        $process = $this->processFor(...$subject);

        if ($record->status === 'registered' && $previousStatus !== 'submitted') {
            $this->log($process, 'hki_submitted', null, $by, false);
        }

        // Sertifikat HKI sudah dikirim lewat notifikasi sendiri.
        $this->log($process, 'hki_'.$record->status, $record->status === 'submitted' ? $record->application_number : $record->registration_number, $by, $record->status === 'submitted');
    }

    /**
     * Penulis naskah biasa boleh mengonfirmasi buku sudah sampai.
     */
    public function canConfirmDelivery(Manuscript $manuscript, User $user, array $progress): bool
    {
        $physical = collect($progress['sections'])->firstWhere('key', 'physical');

        return str_starts_with($progress['subject'], 'order:')
            && $physical['included']
            && collect($physical['steps'])->firstWhere('key', 'shipped')['state'] === 'done'
            && collect($physical['steps'])->firstWhere('key', 'delivered')['state'] !== 'done'
            && $manuscript->authorLinks()->where('user_id', $user->id)->exists();
    }

    // =====================================================================

    /** @return array{0: ?Order, 1: ?Book, 2: ?IsbnApplication} */
    private function context(string $type, int $id): array
    {
        if ($type === 'order') {
            $order = Order::with(['items.itemable', 'manuscript.book', 'manuscript.isbnApplication'])->find($id);

            return [$order, $order?->manuscript?->book, $order?->manuscript?->isbnApplication];
        }

        $book = Book::with('packageItems')->find($id);
        $application = IsbnApplication::where('type', IsbnApplication::TYPE_CHAPTER)->where('book_id', $id)->first();

        return [null, $book, $application];
    }

    /** @param  array{0: string, 1: int}  $subject */
    private function reachedPublishing(Manuscript $manuscript, array $subject): bool
    {
        if ($subject[0] === 'order') {
            return $manuscript->status === 'completed';
        }

        $book = Book::with('compilation:id,compiled_book_id,status')->find($subject[1]);

        return $book !== null && (
            $book->compilation?->status === 'completed'
            || filled($book->isbn)
            || IsbnApplication::where('type', IsbnApplication::TYPE_CHAPTER)->where('book_id', $book->id)->exists()
        );
    }

    private function hkiRecord(string $type, int $id, ?Book $book): ?HkiRecord
    {
        return HkiRecord::query()
            ->where(fn ($query) => $query->where('subject_type', $type)->where('subject_id', $id))
            ->when($type === 'order' && $book, fn ($query) => $query->orWhere(
                fn ($inner) => $inner->where('subject_type', 'book')->where('subject_id', $book->id)
            ))
            ->orderByRaw('case when subject_type = ? then 0 else 1 end', [$type])
            ->first();
    }

    private function includesHki(string $type, ?Order $order, ?Book $book): bool
    {
        return ($order !== null && $this->finance->orderIncludesHki($order))
            || ($book !== null && $this->finance->bookIncludesHki($book));
    }

    /** Buku fisik untuk penulis ada di paket: eksemplar gratis atau fasilitas "cetak/eks". */
    private function includesPhysicalAuto(string $type, ?Order $order, ?Book $book): bool
    {
        $mentions = fn (iterable $texts) => collect($texts)->contains(
            fn ($text) => is_string($text) && preg_match(self::PHYSICAL_PATTERN, $text) && ! preg_match('/isbn/i', $text)
        );

        if ($type === 'order') {
            return (bool) $order?->items->contains(function (OrderItem $item) use ($mentions) {
                $itemable = $item->itemable;

                return match (true) {
                    $itemable instanceof Package => (int) $itemable->free_copies > 0
                        || $mentions([...(array) $itemable->facilities, ...(array) $itemable->services]),
                    $itemable instanceof CustomPackageItem => (int) $itemable->free_copies > 0 || $mentions([$itemable->name]),
                    default => false,
                };
            });
        }

        return $book !== null && (
            $mentions([...(array) $book->facilities, ...(array) $book->services])
            || $book->packageItems->contains(fn (CustomPackageItem $item) => (int) $item->free_copies > 0 || $mentions([$item->name]))
        );
    }

    /** @return array<string, mixed> */
    private function step(string $key, string $label, string $state, ?Carbon $at, array $extra = []): array
    {
        return ['key' => $key, 'label' => $label, 'state' => $state, 'at' => $at?->toIso8601String(), ...$extra];
    }

    /** @param  list<array<string, mixed>>  $sections */
    private function currentLabel(array $sections): string
    {
        return collect($sections)
            ->filter(fn (array $section) => $section['included'])
            ->map(fn (array $section) => collect($section['steps'])->first(fn (array $step) => $step['state'] !== 'done'))
            ->filter()
            ->map(fn (array $step) => $step['state'] === 'current' && $step['key'] === 'isbn_published' ? 'Menunggu ISBN terbit' : $step['label'])
            ->implode(' · ');
    }

    /**
     * Riwayat berurutan waktu: tanda tangan surat + semua kejadian.
     *
     * @param  Collection<int, PublicationProcessEvent>  $events
     * @return list<array<string, mixed>>
     */
    private function history(?IsbnApplication $application, Collection $events): array
    {
        $rows = $events->map(fn (PublicationProcessEvent $event) => [
            'stage' => $event->stage,
            'label' => PublicationProcessEvent::LABELS[$event->stage] ?? $event->stage,
            'note' => $event->note,
            'at' => $event->created_at?->toIso8601String(),
        ]);

        if ($application?->signed_at) {
            $rows->prepend([
                'stage' => 'letter_signed',
                'label' => 'Surat Keaslian Karya ditandatangani',
                'note' => null,
                'at' => $application->signed_at->toIso8601String(),
            ]);
        }

        return $rows->sortBy('at')->values()->all();
    }

    private function log(PublicationProcess $process, string $stage, ?string $note, ?User $by, bool $email): void
    {
        $process->events()->create(['stage' => $stage, 'note' => $note, 'user_id' => $by?->id]);

        $this->notifier->guard(fn () => $this->notifyAuthors($process, $stage, $note, $email));
    }

    /** Semua penulis karya, masing-masing ke halaman naskahnya sendiri. */
    private function notifyAuthors(PublicationProcess $process, string $stage, ?string $note, bool $email): void
    {
        $manuscripts = $process->subject_type === 'order'
            ? Manuscript::with('authorLinks.user', 'user')->where('order_id', $process->subject_id)->get()
            : Manuscript::with('authorLinks.user', 'user')->whereIn(
                'id',
                BookChapter::where('book_id', $process->subject_id)->whereNotNull('manuscript_id')->pluck('manuscript_id')
            )->get();

        $label = PublicationProcessEvent::LABELS[$stage] ?? $stage;

        foreach ($manuscripts as $manuscript) {
            $authors = $manuscript->authorLinks->pluck('user')->filter();
            $authors = $authors->isEmpty() ? collect([$manuscript->user])->filter() : $authors;
            $body = $manuscript->title.($note ? " — {$note}" : '');

            $this->notifier->notify(
                $authors,
                'manuscript',
                "Proses penerbitan: {$label}",
                $body,
                "/dashboard/naskah/{$manuscript->id}",
                ['subject_type' => 'manuscript', 'subject_id' => $manuscript->id, 'email' => $email, 'email_lines' => [
                    "Naskah: {$manuscript->title}",
                    "Tahap: {$label}",
                    ...($note ? ["Keterangan: {$note}"] : []),
                    'Lihat riwayat lengkapnya di menu Naskah Saya.',
                ]]
            );
        }
    }
}
