<?php

namespace App\Services;

use App\Models\Book;
use App\Models\IsbnApplication;
use App\Models\IsbnLetterSetting;
use App\Models\Manuscript;
use App\Models\User;
use App\Support\Isbn\IsbnLetterRenderer;
use Illuminate\Http\Exceptions\HttpResponseException;

class IsbnApplicationService
{
    private const ROMAN_MONTHS = [1 => 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    public function __construct(private readonly BookRoyaltyService $royalty) {}

    /** Penulis pertama sebuah naskah: urutan pertama co-author, atau pemilik naskah. */
    public function firstAuthor(Manuscript $manuscript): ?User
    {
        $manuscript->loadMissing(['authorLinks.user', 'user']);

        return $manuscript->authorLinks->first()?->user ?? $manuscript->user;
    }

    /**
     * Permohonan ISBN untuk naskah paket biasa: hanya setelah naskah selesai
     * diedit dan disetujui penulis, dan hanya penulis pertama yang boleh.
     */
    public function forManuscript(Manuscript $manuscript, User $user): IsbnApplication
    {
        $manuscript->loadMissing(['authorLinks.user', 'user', 'bookChapter']);

        $this->deny(
            $manuscript->bookChapter !== null || $manuscript->compiled_book_id !== null,
            'Naskah bab Book Chapter diajukan ISBN-nya oleh editor proyek.'
        );
        $this->deny($manuscript->status !== 'completed', 'ISBN baru bisa diajukan setelah naskah selesai diedit dan disetujui penulis.');
        $this->deny(
            $this->firstAuthor($manuscript)?->id !== $user->id,
            'Hanya penulis pertama yang dapat mengajukan ISBN dan menandatangani surat keaslian karya.',
            403
        );

        $existing = IsbnApplication::where('manuscript_id', $manuscript->id)->first();

        if ($existing) {
            return $existing;
        }

        $authors = $manuscript->authorLinks->map(fn ($link) => $link->user?->name)->filter();

        return $this->create([
            'type' => IsbnApplication::TYPE_REGULAR,
            'manuscript_id' => $manuscript->id,
            'availability_link' => $this->bookUrl($manuscript->book),
            'title' => $manuscript->title,
            'authors_text' => ($authors->isNotEmpty() ? $authors : collect([$manuscript->user?->name]))->filter()->implode(', '),
        ], $user);
    }

    /**
     * Permohonan ISBN untuk proyek Book Chapter: editor pemilik proyek,
     * setelah semua bab terisi dan selesai.
     */
    public function forBook(Book $book, User $user): IsbnApplication
    {
        $book->loadMissing(['chapters.manuscript.authorLinks.user', 'chapters.manuscript.user', 'ownerEditor']);

        $this->deny(! $book->is_chapter_compilation, 'Buku ini bukan proyek Book Chapter.');
        $this->deny($book->owner_editor_id !== $user->id, 'Hanya editor pemilik proyek yang dapat mengajukan ISBN.', 403);
        $this->deny($book->chapters->isEmpty(), 'Proyek belum punya bab.');
        $this->deny(
            $book->chapters->contains(fn ($chapter) => $chapter->manuscript?->status !== 'completed'),
            'Semua bab harus sudah terisi dan selesai disetujui penulis sebelum ISBN diajukan.'
        );

        $existing = IsbnApplication::where('book_id', $book->id)->first();

        if ($existing) {
            return $existing;
        }

        $writers = $this->royalty->authors($book)->pluck('name')->implode(', ');

        return $this->create([
            'type' => IsbnApplication::TYPE_CHAPTER,
            'book_id' => $book->id,
            'availability_link' => $this->bookUrl($book),
            'title' => $book->title,
            'authors_text' => 'Editor: '.$user->name.($writers !== '' ? '; Penulis: '.$writers : ''),
        ], $user);
    }

    /**
     * Data penanda tangan dari Data Pribadi. Kalau ada yang kosong, penulis/
     * editor diminta melengkapinya (422 dengan daftar kolom yang kurang).
     *
     * @return array{name: string, address: string, nik: string, phone: string}
     */
    public function applicantData(User $user): array
    {
        $profile = $user->personalProfile;

        $data = [
            'name' => $user->name,
            'address' => trim((string) ($profile?->ktp_address ?: $profile?->domicile_address)),
            'nik' => trim((string) $profile?->nik),
            'phone' => trim((string) $profile?->phone),
        ];

        $labels = ['address' => 'Alamat', 'nik' => 'NIK', 'phone' => 'No. HP'];
        $missing = array_keys(array_filter($labels, fn ($label, $key) => $data[$key] === '', ARRAY_FILTER_USE_BOTH));

        if ($missing !== []) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => 'Lengkapi Data Pribadi Anda dulu ('.implode(', ', array_map(fn ($key) => $labels[$key], $missing)).') sebelum mengajukan ISBN.',
                'missing' => $missing,
            ], 422));
        }

        return $data;
    }

    /** Selama masih draf, data penanda tangan dan link buku mengikuti data terbaru. */
    public function refresh(IsbnApplication $application): IsbnApplication
    {
        if ($application->status === IsbnApplication::STATUS_DRAFT) {
            $book = $application->type === IsbnApplication::TYPE_CHAPTER
                ? $application->book
                : $application->manuscript?->book;

            $application->update([
                'applicant_data' => $this->applicantData($application->applicant),
                'availability_link' => $this->bookUrl($book) ?? $application->availability_link,
            ]);
        }

        return $application;
    }

    /** Buku yang sudah terbit (aktif) untuk surat ini, atau null kalau admin belum menerbitkannya. */
    public function publishedBook(IsbnApplication $application): ?Book
    {
        $book = $application->type === IsbnApplication::TYPE_CHAPTER
            ? $application->book
            : $application->manuscript?->book;

        return $book?->is_active ? $book : null;
    }

    /** Pilihan isian formulir ISBN (nilai tersimpan => label). */
    public const FORM_OPTIONS = [
        'request_type' => ['lepas' => 'Lepas', 'jilid' => 'Jilid'],
        'media' => ['cetak' => 'Cetak', 'pdf' => 'PDF', 'epub' => 'Epub'],
        'reader_group' => ['anak' => 'Anak', 'dewasa' => 'Dewasa', 'semua_umur' => 'Semua umur'],
        'literature_type' => ['fiksi' => 'Fiksi', 'non_fiksi' => 'Non fiksi'],
        'translation' => ['terjemahan' => 'Terjemahan', 'non_terjemahan' => 'Non terjemahan'],
        'kdt' => ['ya' => 'Ya, prioritaskan pengajuan KDT kami.', 'tidak' => 'Tidak'],
        'illustrations' => ['ya' => 'Ya', 'tidak' => 'Tidak'],
    ];

    /**
     * Data pengisian formulir pengajuan ISBN (untuk admin): nilai bawaan dari
     * naskah/buku, ditimpa isian yang disimpan admin.
     *
     * @return array<string, mixed>
     */
    public function form(IsbnApplication $application): array
    {
        $application->loadMissing(['manuscript.editor', 'manuscript.authorLinks.user', 'manuscript.book', 'book.ownerEditor', 'book.chapters.manuscript']);

        $chapter = $application->type === IsbnApplication::TYPE_CHAPTER;
        $book = $chapter ? $application->book : $application->manuscript?->book;

        $authors = $chapter
            ? $this->royalty->authors($application->book->loadMissing(['chapters.manuscript.authorLinks.user', 'chapters.manuscript.user']))->pluck('name')->all()
            : $application->manuscript->authorLinks->map(fn ($link) => $link->user?->name)->filter()->values()->all();

        if ($authors === []) {
            $authors = [$application->applicant?->name];
        }

        $editor = $chapter ? $application->book?->ownerEditor?->name : $application->manuscript?->editor?->name;

        $defaults = [
            'request_type' => 'lepas',
            'title' => $application->title,
            'authors' => array_values(array_filter($authors)),
            'editor' => $editor,
            'designer' => $book?->cover_layout_designer,
            'media' => $book?->includes_isbn_print ? 'cetak' : ($book?->includes_isbn_electronic ? 'pdf' : null),
            'reader_group' => null,
            'literature_type' => null,
            'translation' => null,
            'kdt' => 'ya',
            'estimated_publish' => IsbnLetterRenderer::formatMonthYear($application->created_at->copy()->addDays(7)),
            'province' => 'Kepulauan Riau',
            'city' => 'Kota Batam',
            'distributor' => 'Tartila Press',
            'description' => $book?->description,
            'pages' => null,
            'height_cm' => null,
            'edition' => 'Pertama',
            'series' => null,
            'illustrations' => 'tidak',
            'publication_url' => $this->bookUrl($book),
        ];

        return array_merge($defaults, $application->form_data ?? []);
    }

    /**
     * Lampiran formulir: berkas dummy (revisi terakhir yang disetujui
     * penulis), cover buku, dan link publikasi.
     *
     * @return array{dummy_files: list<array{label: string, manuscript_id: int, revision_id: int, filename: string}>, dummy: array{label: string, filename: string, is_pdf: bool}|null, cover_url: string|null, has_cover: bool}
     */
    public function attachments(IsbnApplication $application): array
    {
        $chapter = $application->type === IsbnApplication::TYPE_CHAPTER;

        $manuscripts = $chapter
            ? $application->book->loadMissing('chapters.manuscript')->chapters->sortBy('chapter_number')
                ->map(fn ($c) => $c->manuscript ? [$c->manuscript, 'Bab '.$c->chapter_number.' — '.$c->title] : null)->filter()->values()
            : collect([[$application->manuscript, 'Naskah']]);

        $files = [];

        foreach ($manuscripts as [$manuscript, $label]) {
            // Daftar admin sudah memuat semua revisi sekaligus; selain itu satu query.
            $revision = $manuscript->relationLoaded('revisions')
                ? $manuscript->revisions->sortByDesc('revision_number')->first()
                : $manuscript->latestRevision();

            if ($revision) {
                $files[] = [
                    'label' => $label,
                    'manuscript_id' => $manuscript->id,
                    'revision_id' => $revision->id,
                    'filename' => $revision->original_filename,
                ];
            }
        }

        $book = $chapter ? $application->book : $application->manuscript?->book;
        $dummy = $this->dummySource($application);

        return [
            'dummy_files' => $files,
            'dummy' => $dummy ? ['label' => $dummy['label'], 'filename' => $dummy['filename'], 'is_pdf' => $dummy['is_pdf']] : null,
            'cover_url' => $book?->front_cover,
            'has_cover' => filled($book?->front_cover),
        ];
    }

    /**
     * Berkas dummy buku utuh untuk lampiran ISBN (dari cover sampai daftar
     * isi ikut di dalamnya). Urutan: ebook buku terbit, naskah gabungan
     * Book Chapter, lalu revisi terakhir naskah. PDF didahulukan karena
     * hanya PDF yang bisa digabung dengan surat menjadi file attachment.
     *
     * @return array{label: string, path: string, filename: string, is_pdf: bool}|null
     */
    public function dummySource(IsbnApplication $application): ?array
    {
        $chapter = $application->type === IsbnApplication::TYPE_CHAPTER;
        $book = $chapter ? $application->book : $application->manuscript?->book;
        $candidates = [];

        if (filled($book?->ebook_file)) {
            $candidates[] = ['label' => 'Ebook buku', 'path' => $book->ebook_file, 'filename' => $book->ebook_name ?: basename($book->ebook_file)];
        }

        $manuscript = $chapter ? $book?->compilation : $application->manuscript;

        if ($manuscript) {
            $revision = $manuscript->relationLoaded('revisions')
                ? $manuscript->revisions->sortByDesc('revision_number')->first()
                : $manuscript->latestRevision();

            if ($revision && $revision->file_path) {
                $candidates[] = [
                    'label' => $chapter ? 'Naskah gabungan' : 'Naskah',
                    'path' => $revision->file_path,
                    'filename' => $revision->original_filename ?: basename($revision->file_path),
                ];
            }
        }

        $candidates = array_map(fn (array $file) => $file + [
            'is_pdf' => strtolower(pathinfo($file['filename'], PATHINFO_EXTENSION)) === 'pdf',
        ], $candidates);

        return collect($candidates)->firstWhere('is_pdf', true) ?? ($candidates[0] ?? null);
    }

    /** Link halaman buku di situs ("link/akses ketersediaan buku" di surat). */
    public function bookUrl(?Book $book): ?string
    {
        return $book?->slug
            ? rtrim((string) config('app.frontend_url'), '/').'/buku/'.$book->slug
            : null;
    }

    /** PDF surat; $sealed = dengan tanda tangan + stempel penerbit (khusus admin). */
    public function pdf(IsbnApplication $application, bool $sealed): string
    {
        return (new IsbnLetterRenderer)->render($application, $sealed);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function create(array $attributes, User $user): IsbnApplication
    {
        $now = now();
        $settings = IsbnLetterSetting::current();
        $sequence = IsbnApplication::whereYear('created_at', $now->year)->count() + 1;

        return IsbnApplication::create($attributes + [
            'applicant_id' => $user->id,
            'letter_number' => sprintf('%03d/%s/%s/%d', $sequence, $settings->letter_code, self::ROMAN_MONTHS[$now->month], $now->year),
            'letter_date' => $now->toDateString(),
            'applicant_data' => $this->applicantData($user),
            'status' => IsbnApplication::STATUS_DRAFT,
        ]);
    }

    private function deny(bool $condition, string $message, int $status = 422): void
    {
        if ($condition) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => $message,
            ], $status));
        }
    }
}
