<?php

namespace App\Services\Reader;

use App\Models\Book;
use App\Models\Partner;
use App\Models\PartnerBookEvent;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderTerm;
use App\Models\Scopes\ExcludePartnerBooks;
use App\Models\User;
use App\Services\Notifier;
use App\Support\PdfPages;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Siklus buku mitra Tartila Book: draft -> diajukan -> disetujui / ditolak (dengan catatan) ->
 * diperbaiki mitra -> diajukan ulang. Hanya buku yang disetujui admin yang tampil di katalog.
 */
class PartnerBookService
{
    public const DOCUMENTS = [
        'turnitin' => 'Hasil Turnitin',
        'originality' => 'Surat keaslian naskah',
        'mou' => 'MOU',
    ];

    /** Batas kemiripan Turnitin: harus di bawah ini (persen). */
    public const MAX_SIMILARITY = 20.0;

    public function __construct(private readonly Notifier $notifier) {}

    /** Buku mitra dicari tanpa saringan buku mitra. */
    public static function query()
    {
        return Book::withoutGlobalScope(ExcludePartnerBooks::class)->whereNotNull('partner_id');
    }

    public static function find(int|string $id): Book
    {
        return self::query()->with(['readerBook', 'partnerAuthors', 'partner.user'])->findOrFail($id);
    }

    /** Draft / ditolak boleh diubah mitra; diajukan dan disetujui terkunci. */
    public function isEditable(Book $book): bool
    {
        return in_array($book->partner_status, ['draft', 'rejected'], true);
    }

    // =====================================================================
    // Data buku
    // =====================================================================

    /** @param array<string, mixed> $data */
    public function create(Partner $partner, array $data): Book
    {
        $this->checkTerms($data);

        return DB::transaction(function () use ($partner, $data) {
            $book = new Book([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'about' => $data['about'] ?? null,
                'front_cover' => $data['front_cover'] ?? null,
                'languages' => [$data['language'] ?? 'id'],
                'price' => 0,
                'discount' => 0,
                'is_active' => false,
                'created_by' => $partner->user_id,
            ]);
            $book->forceFill(['partner_id' => $partner->id, 'partner_status' => 'draft'])->save();

            ReaderBook::create($this->readerFields($data) + ['book_id' => $book->id, 'is_published' => false]);
            $this->syncAuthors($book, $data['author_ids']);

            return self::find($book->id);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Book $book, array $data): Book
    {
        abort_unless($this->isEditable($book), 422, 'Buku yang sedang diajukan atau sudah disetujui tidak bisa diubah. Tarik kembali untuk revisi dulu.');

        $this->checkTerms($data + ['pustaka' => $book->readerBook?->pustaka]);

        return DB::transaction(function () use ($book, $data) {
            $book->fill(array_filter([
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'about' => $data['about'] ?? null,
                'front_cover' => $data['front_cover'] ?? null,
            ], fn ($value) => $value !== null));

            if (isset($data['language'])) {
                $book->languages = [$data['language']];
            }

            $book->save();
            $book->readerBook?->update($this->readerFields($data));

            if (isset($data['author_ids'])) {
                $this->syncAuthors($book, $data['author_ids']);
            }

            return self::find($book->id);
        });
    }

    /**
     * Penulis wajib sudah punya akun (supaya bisa melihat royalti); nama tampil = nama pena / nama akun.
     *
     * @param  list<int>  $ids
     */
    public function syncAuthors(Book $book, array $ids): void
    {
        $ids = collect($ids)->map(fn ($id) => (int) $id)->unique()->values();
        $users = User::with('publicProfile')->whereIn('id', $ids)->get()->keyBy('id');

        if ($ids->isEmpty() || $users->count() !== $ids->count()) {
            throw ValidationException::withMessages(['author_ids' => 'Pilih minimal satu penulis yang sudah punya akun Tartila Press.']);
        }

        $book->partnerAuthors()->sync($ids->mapWithKeys(fn ($id, $index) => [$id => ['position' => $index + 1]])->all());

        $names = $ids->map(fn ($id) => $users[$id]->publicProfile?->pen_name ?: $users[$id]->name)->all();
        $book->forceFill(['authors' => $names, 'authors_text' => implode(', ', $names)])->save();
    }

    /** @return array<string, mixed> */
    private function readerFields(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'pustaka', 'education_field_id', 'category_id', 'genre_id', 'age_limit', 'language', 'price', 'access_days',
        ]));
    }

    /** Taksonomi harus sesuai jenisnya (dan kategori sesuai jenis pustaka). @param array<string, mixed> $data */
    private function checkTerms(array $data): void
    {
        foreach (['education_field_id' => 'education_field', 'category_id' => 'category', 'genre_id' => 'genre'] as $field => $type) {
            if (empty($data[$field])) {
                continue;
            }

            $term = ReaderTerm::where('type', $type)->find($data[$field]);

            if (! $term) {
                throw ValidationException::withMessages([$field => 'Pilihan '.ReaderTerm::TYPES[$type].' tidak valid.']);
            }

            if ($type === 'category' && $term->pustaka && isset($data['pustaka']) && $term->pustaka !== $data['pustaka']) {
                throw ValidationException::withMessages([$field => 'Kategori buku ini tidak berlaku untuk jenis pustaka yang dipilih.']);
            }
        }
    }

    // =====================================================================
    // Berkas
    // =====================================================================

    /** Ebook PDF mitra (disimpan privat seperti ebook Tartila Press). */
    public function storeEbook(Book $book, UploadedFile $file, ?int $pageCount): Book
    {
        abort_unless($this->isEditable($book), 422, 'Buku yang sedang diajukan atau sudah disetujui tidak bisa diubah.');

        $previous = $book->ebook_file;
        $path = $file->storeAs('ebooks/'.$book->id, bin2hex(random_bytes(16)).'.pdf', 'local');

        $pages = $pageCount ?? PdfPages::count(Storage::disk('local')->path($path));

        if (! $pages) {
            Storage::disk('local')->delete($path);

            throw ValidationException::withMessages(['file' => 'Jumlah halaman PDF tidak terbaca. Pastikan berkasnya PDF yang valid.']);
        }

        $book->forceFill([
            'ebook_file' => $path,
            'ebook_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'ebook_uploaded_at' => now(),
            'ebook_pages' => $pages,
        ])->save();

        if ($previous && $previous !== $path) {
            Storage::disk('local')->delete($previous);
        }

        return $book;
    }

    /** Hasil Turnitin (dengan persen kemiripan), surat keaslian, atau MOU bertanda tangan. */
    public function storeDocument(Book $book, string $kind, UploadedFile $file, ?float $percent): Book
    {
        abort_unless($this->isEditable($book), 422, 'Buku yang sedang diajukan atau sudah disetujui tidak bisa diubah.');
        abort_unless(isset(self::DOCUMENTS[$kind]), 404);

        if ($kind === 'turnitin') {
            if ($percent === null || $percent < 0 || $percent >= self::MAX_SIMILARITY) {
                throw ValidationException::withMessages(['percent' => 'Persentase kemiripan Turnitin harus di bawah '.(int) self::MAX_SIMILARITY.'%.']);
            }
        }

        $documents = (array) $book->partner_documents;
        $previous = $documents[$kind]['path'] ?? null;
        $path = $file->storeAs('partner-docs/'.$book->id, $kind.'-'.bin2hex(random_bytes(12)).'.'.strtolower($file->getClientOriginalExtension()), 'local');

        $documents[$kind] = array_filter([
            'path' => $path,
            'name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'percent' => $kind === 'turnitin' ? round((float) $percent, 2) : null,
            'uploaded_at' => now()->toIso8601String(),
        ], fn ($value) => $value !== null);

        $book->forceFill(['partner_documents' => $documents])->save();

        if ($previous) {
            Storage::disk('local')->delete($previous);
        }

        return $book;
    }

    /** Lokasi berkas privat untuk diunduh: ebook atau salah satu dokumen. */
    public function documentPath(Book $book, string $kind): ?array
    {
        if ($kind === 'ebook') {
            return $book->ebook_file ? ['path' => $book->ebook_file, 'name' => $book->ebook_name ?: 'ebook.pdf'] : null;
        }

        $document = ((array) $book->partner_documents)[$kind] ?? null;

        return $document ? ['path' => $document['path'], 'name' => $document['name'] ?? basename($document['path'])] : null;
    }

    // =====================================================================
    // Alur status
    // =====================================================================

    /** Hal yang masih kurang sebelum buku bisa diajukan (kosong = lengkap). @return list<string> */
    public function missing(Book $book): array
    {
        $missing = [];
        $reader = $book->readerBook;
        $documents = (array) $book->partner_documents;

        if (blank($book->title)) {
            $missing[] = 'Judul buku';
        }

        if ($book->partnerAuthors->isEmpty()) {
            $missing[] = 'Penulis (akun terdaftar)';
        }

        if (blank($book->front_cover)) {
            $missing[] = 'Sampul buku';
        }

        if (blank($book->description)) {
            $missing[] = 'Deskripsi buku';
        }

        if (! $reader || blank($reader->pustaka) || blank($reader->language)) {
            $missing[] = 'Klasifikasi buku (jenis pustaka dan bahasa)';
        }

        if (! $book->hasReadableEbook()) {
            $missing[] = 'Ebook PDF';
        }

        foreach (self::DOCUMENTS as $kind => $label) {
            if (empty($documents[$kind]['path'])) {
                $missing[] = $label;
            }
        }

        if (isset($documents['turnitin']['percent']) && (float) $documents['turnitin']['percent'] >= self::MAX_SIMILARITY) {
            $missing[] = 'Hasil Turnitin di bawah '.(int) self::MAX_SIMILARITY.'%';
        }

        return $missing;
    }

    public function submit(Book $book, User $actor): Book
    {
        abort_unless($this->isEditable($book), 422, 'Buku ini sudah diajukan atau disetujui.');

        $missing = $this->missing($book);

        if ($missing !== []) {
            throw ValidationException::withMessages(['book' => 'Lengkapi dulu: '.implode(', ', $missing).'.']);
        }

        $resubmit = $book->partner_status === 'rejected';

        $this->transition($book, 'submitted', $actor, $resubmit ? 'resubmitted' : 'submitted', null, ['partner_submitted_at' => now(), 'partner_note' => $book->partner_note]);

        $this->notifier->guard(fn () => $this->notifier->notifyAdmins(
            'reader',
            $resubmit ? 'Ebook mitra diajukan ulang' : 'Ebook mitra menunggu persetujuan',
            "{$book->title} — {$book->partner->company_name}",
            "/admin/mitra/buku/{$book->id}",
            ['subject_type' => 'partner_book', 'subject_id' => $book->id]
        ));

        return self::find($book->id);
    }

    /** Menarik buku yang sedang diajukan / sudah disetujui kembali ke draft untuk direvisi (hilang dari katalog). */
    public function reopen(Book $book, User $actor): Book
    {
        abort_unless(in_array($book->partner_status, ['submitted', 'approved'], true), 422, 'Buku ini tidak sedang diajukan atau disetujui.');

        $this->transition($book, 'draft', $actor, 'reopened', null, ['is_active' => false]);
        $book->readerBook?->update(['is_published' => false]);

        $this->notifier->guard(fn () => $this->notifier->notifyAdmins(
            'reader',
            'Mitra menarik ebook untuk revisi',
            "{$book->title} — {$book->partner->company_name}",
            "/admin/mitra/buku/{$book->id}",
            ['subject_type' => 'partner_book', 'subject_id' => $book->id]
        ));

        return self::find($book->id);
    }

    public function approve(Book $book, User $admin): Book
    {
        abort_unless($book->partner_status === 'submitted', 422, 'Hanya buku yang diajukan yang bisa disetujui.');

        DB::transaction(function () use ($book, $admin) {
            $this->transition($book, 'approved', $admin, 'approved', null, ['is_active' => true, 'partner_note' => null, 'partner_reviewed_at' => now(), 'partner_reviewed_by' => $admin->id]);
            $book->readerBook?->update(['is_published' => true]);
        });

        $this->notifier->guard(function () use ($book) {
            $link = "/mitra/buku/{$book->id}";
            $ref = ['subject_type' => 'partner_book', 'subject_id' => $book->id];

            $this->notifier->notify($book->partner->user, 'reader', 'Ebook disetujui', "{$book->title} sudah tampil di katalog Tartila Book.", $link, $ref);
            $this->notifier->notify($book->partnerAuthors, 'reader', 'Buku Anda tayang di Tartila Book', "{$book->title} (mitra {$book->partner->company_name}). Pantau royalti di menu Royalti.", '/royalti', $ref);
        });

        return self::find($book->id);
    }

    public function reject(Book $book, User $admin, string $note): Book
    {
        abort_unless($book->partner_status === 'submitted', 422, 'Hanya buku yang diajukan yang bisa ditolak.');

        $this->transition($book, 'rejected', $admin, 'rejected', $note, ['is_active' => false, 'partner_note' => $note, 'partner_reviewed_at' => now(), 'partner_reviewed_by' => $admin->id]);
        $book->readerBook?->update(['is_published' => false]);

        $this->notifier->guard(fn () => $this->notifier->notify(
            $book->partner->user,
            'reader',
            'Ebook ditolak, mohon diperbaiki',
            "{$book->title} — Catatan admin: {$note}",
            "/mitra/buku/{$book->id}",
            ['subject_type' => 'partner_book', 'subject_id' => $book->id, 'email' => true, 'email_lines' => ["Ebook \"{$book->title}\" ditolak.", "Catatan admin: {$note}", 'Perbaiki sesuai catatan lalu ajukan ulang.']]
        ));

        return self::find($book->id);
    }

    /** Hapus draft beserta berkasnya. */
    public function delete(Book $book): void
    {
        abort_unless($book->partner_status === 'draft', 422, 'Hanya draft yang bisa dihapus.');

        foreach ([$book->ebook_file, ...collect((array) $book->partner_documents)->pluck('path')->all()] as $path) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
        }

        DB::transaction(function () use ($book) {
            $book->readerBook?->delete();
            $book->delete();
        });
    }

    /** @param array<string, mixed> $changes */
    private function transition(Book $book, string $status, User $actor, string $action, ?string $note, array $changes = []): void
    {
        $book->forceFill(['partner_status' => $status] + $changes)->save();

        PartnerBookEvent::create(['book_id' => $book->id, 'action' => $action, 'note' => $note, 'user_id' => $actor->id]);
    }
}
