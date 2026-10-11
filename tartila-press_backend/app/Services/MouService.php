<?php

namespace App\Services;

use App\Models\Book;
use App\Models\CustomPackageItem;
use App\Models\IsbnApplication;
use App\Models\IsbnLetterSetting;
use App\Models\Manuscript;
use App\Models\Mou;
use App\Models\MouSignatory;
use App\Models\MouTemplate;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\User;
use App\Support\Mou\MouRenderer;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * MOU distribusi buku.
 *
 * - Paket biasa: satu MOU per naskah, dibuat setelah naskah selesai. Penulis
 *   pertama menandatanganinya SEKALIAN dengan surat ISBN (dan memilih hak
 *   distribusi bila admin mengatur "pilih salah satu"); penulis lain hanya
 *   menandatangani MOU.
 * - Book Chapter: satu MOU per buku, disetujui tiap penulis bab saat
 *   menyetujui naskah akhir (naskah gabungan).
 * - Royalti buku fisik & ebook dari template (total per judul), hanya jenis
 *   yang sesuai layanan ISBN paketnya; dibagi rata antar-penulis (Book
 *   Chapter: per bab yang ditulis).
 * - Isi MOU = salinan template; mengikuti template terbaru selama belum ada
 *   yang menandatangani dan admin belum menyesuaikannya (berlaku maju).
 * - Semua penulis sudah tanda tangan → penerbit menandatangani + stempel +
 *   meterai (di luar sistem), admin mengunggah PDF bermeterai.
 */
class MouService
{
    private const ROMAN_MONTHS = [1 => 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    private const COMPILATION_STAGES = ['pending_penulis_review', 'completed'];

    public function __construct(private readonly Notifier $notifier) {}

    // =====================================================================
    // Pembuatan
    // =====================================================================

    /**
     * MOU paket biasa sebuah naskah (dibuat bila naskah sudah selesai dan
     * belum terbit); null bila naskah belum/tidak memenuhi.
     */
    public function forManuscript(Manuscript $manuscript): ?Mou
    {
        $manuscript->loadMissing(['mou', 'bookChapter', 'book']);

        if ($manuscript->mou) {
            return $this->sync($manuscript->mou);
        }

        $eligible = $manuscript->status === 'completed'
            && $manuscript->bookChapter === null
            && $manuscript->compiled_book_id === null
            && $manuscript->book === null;

        return $eligible ? $this->create(Mou::TYPE_REGULAR, ['manuscript_id' => $manuscript->id], $manuscript->title) : null;
    }

    /** MOU Book Chapter (dibuat saat naskah gabungan masuk review akhir penulis). */
    public function forBook(Book $book): ?Mou
    {
        $book->loadMissing(['chapterMou', 'compilation']);

        if ($book->chapterMou) {
            return $this->sync($book->chapterMou);
        }

        $eligible = $book->is_chapter_compilation
            && in_array($book->compilation?->status, self::COMPILATION_STAGES, true);

        return $eligible ? $this->create(Mou::TYPE_CHAPTER, ['book_id' => $book->id], $book->title) : null;
    }

    public function forCompilation(Manuscript $compilation): ?Mou
    {
        $book = $compilation->compiled_book_id ? Book::find($compilation->compiled_book_id) : null;

        return $book ? $this->forBook($book) : null;
    }

    /** Buat MOU yang seharusnya sudah ada untuk naskah-naskah penulis ini. */
    public function ensureForUser(User $user): void
    {
        $isAuthor = fn ($query) => $query->where('user_id', $user->id);

        Manuscript::whereHas('authorLinks', $isAuthor)
            ->where('status', 'completed')
            ->whereNull('compiled_book_id')
            ->doesntHave('bookChapter')
            ->doesntHave('book')
            ->doesntHave('mou')
            ->get()
            ->each(fn (Manuscript $manuscript) => $this->forManuscript($manuscript));

        Manuscript::whereHas('authorLinks', $isAuthor)
            ->whereNotNull('compiled_book_id')
            ->whereIn('status', self::COMPILATION_STAGES)
            ->get()
            ->each(fn (Manuscript $compilation) => $this->forCompilation($compilation));
    }

    /** @param  array<string, int>  $subject */
    private function create(string $type, array $subject, string $title): Mou
    {
        $mou = DB::transaction(function () use ($type, $subject, $title) {
            $now = now();
            $sequence = Mou::whereYear('created_at', $now->year)->count() + 1;
            $template = MouTemplate::current($type);

            $mou = Mou::create($subject + [
                'type' => $type,
                'number' => sprintf('%03d/MOU/TP/%s/%d', $sequence, self::ROMAN_MONTHS[$now->month], $now->year),
                'title' => $title,
                'content' => $this->contentFrom($template, null),
                'status' => Mou::STATUS_PENDING,
            ]);

            return $this->sync($mou);
        });

        $this->notifier->guard(fn () => $this->notifier->notify(
            $mou->signatories->pluck('user')->filter(),
            'mou',
            'MOU distribusi buku perlu ditandatangani',
            $mou->title,
            "/dashboard/mou/{$mou->id}",
            ['subject_type' => 'mou', 'subject_id' => $mou->id, 'email' => true, 'email_lines' => [
                "Naskah \"{$mou->title}\" siap diterbitkan.",
                'Tinjau dan tandatangani MOU distribusi buku sebelum buku diterbitkan.',
            ]]
        ));

        return $mou;
    }

    // =====================================================================
    // Sinkron dengan template & penulis (hanya sebelum ada tanda tangan)
    // =====================================================================

    public function sync(Mou $mou): Mou
    {
        $mou->loadMissing('signatories.user');

        if ($mou->status !== Mou::STATUS_PENDING || $mou->signatories->whereNotNull('signed_at')->isNotEmpty()) {
            return $mou;
        }

        DB::transaction(function () use ($mou) {
            if (! $mou->customized) {
                $mou->content = $this->contentFrom(MouTemplate::current($mou->type), $mou);
            }

            $content = $mou->content;
            $keys = array_column($content['distribution_options'], 'key');

            // Pilih semua: semua hak distribusi. Book Chapter "pilih salah
            // satu": bawaan opsi pertama (admin bisa mengubahnya).
            if ($content['distribution_mode'] === 'all') {
                $mou->distribution_choice = $keys;
            } elseif (array_diff((array) $mou->distribution_choice, $keys) !== [] || $mou->distribution_choice === []) {
                $mou->distribution_choice = null;
            }

            if ($mou->type === Mou::TYPE_CHAPTER && $content['distribution_mode'] === 'one' && ! $mou->distribution_choice && $keys !== []) {
                $mou->distribution_choice = [$keys[0]];
            }

            $mou->title = $this->subjectTitle($mou) ?? $mou->title;
            $mou->save();

            $this->syncSignatories($mou);
        });

        return $mou->load('signatories.user');
    }

    /** @return array<string, mixed> */
    private function contentFrom(MouTemplate $template, ?Mou $mou): array
    {
        $content = $template->snapshot();
        $types = $mou ? $this->royaltyTypes($mou) : ['physical' => true, 'ebook' => true];

        $content['royalty_types'] = $types;
        $content['royalty'] = [
            'physical' => $types['physical'] ? $content['royalty']['physical'] : null,
            'ebook' => $types['ebook'] ? $content['royalty']['ebook'] : null,
        ];

        return $content;
    }

    private function syncSignatories(Mou $mou): void
    {
        $authors = $this->authorsFor($mou);
        $royalty = $mou->content['royalty'];
        $existing = $mou->signatories()->get()->keyBy('user_id');

        $mou->signatories()->whereNotIn('user_id', $authors->pluck('user.id'))->delete();

        foreach ($authors->values() as $index => $author) {
            $current = $existing->get($author['user']->id);
            $computed = [
                'royalty_physical' => $royalty['physical'] === null ? null : round($royalty['physical'] * $author['share'], 4),
                'royalty_ebook' => $royalty['ebook'] === null ? null : round($royalty['ebook'] * $author['share'], 4),
            ];

            MouSignatory::updateOrCreate(
                ['mou_id' => $mou->id, 'user_id' => $author['user']->id],
                ['position' => $index + 1, 'chapters' => $author['chapters']]
                    // MOU yang disesuaikan admin: royalti penulis lama tetap.
                    + ($mou->customized && $current ? [] : $computed)
            );
        }
    }

    /**
     * Penulis MOU dan bagian royaltinya (pecahan dari total per judul).
     * Paket biasa: dibagi rata. Book Chapter: tiap bab bernilai 1/jumlah bab,
     * dibagi rata antar-penulis bab itu.
     *
     * @return Collection<int, array{user: User, share: float, chapters: ?int}>
     */
    public function authorsFor(Mou $mou): Collection
    {
        if ($mou->type === Mou::TYPE_REGULAR) {
            $manuscript = $mou->manuscript()->with(['authorLinks.user', 'user'])->first();
            $users = $manuscript ? $this->manuscriptAuthors($manuscript) : collect();

            return $users->map(fn (User $user) => ['user' => $user, 'share' => 1 / max(1, $users->count()), 'chapters' => null])->values();
        }

        $book = Book::with(['chapters.manuscript.authorLinks.user', 'chapters.manuscript.user'])->find($mou->book_id);
        $chapters = $book?->chapters ?? collect();
        $total = max(1, $chapters->count());
        $rows = [];

        foreach ($chapters as $chapter) {
            if (! $chapter->manuscript) {
                continue;
            }

            $writers = $this->manuscriptAuthors($chapter->manuscript);

            foreach ($writers as $writer) {
                $rows[$writer->id] ??= ['user' => $writer, 'share' => 0.0, 'chapters' => 0];
                $rows[$writer->id]['share'] += 1 / $total / $writers->count();
                $rows[$writer->id]['chapters']++;
            }
        }

        return collect(array_values($rows));
    }

    /**
     * Jenis royalti dari layanan ISBN paket: cetak → buku fisik, elektronik
     * → ebook. Tanpa keterangan jenis: buku fisik.
     *
     * @return array{physical: bool, ebook: bool}
     */
    public function royaltyTypes(Mou $mou): array
    {
        $book = $mou->type === Mou::TYPE_CHAPTER
            ? Book::find($mou->book_id)
            : $mou->manuscript?->book;

        if ($book && ($book->includes_isbn_print || $book->includes_isbn_electronic)) {
            return ['physical' => (bool) $book->includes_isbn_print, 'ebook' => (bool) $book->includes_isbn_electronic];
        }

        $texts = [];

        if ($mou->type === Mou::TYPE_REGULAR) {
            $items = $mou->manuscript?->order?->items()->with('itemable')->get() ?? collect();

            foreach ($items as $item) {
                /** @var OrderItem $item */
                $itemable = $item->itemable;

                if ($itemable instanceof Package) {
                    array_push($texts, ...(array) $itemable->facilities, ...(array) $itemable->services);
                } elseif ($itemable instanceof CustomPackageItem) {
                    $texts[] = $itemable->name;
                }
            }
        } else {
            $texts = [...(array) $book?->facilities, ...(array) $book?->services,
                ...($book?->packageItems()->pluck('name')->all() ?? [])];
        }

        $physical = false;
        $ebook = false;

        foreach ($texts as $text) {
            if (! is_string($text) || ! preg_match('/isbn/i', $text)) {
                continue;
            }

            $isEbook = (bool) preg_match('/(e-?book|elektronik|digital|pdf|epub)/i', $text);
            $isPrint = (bool) preg_match('/(cetak|fisik|print)/i', $text);

            $ebook = $ebook || $isEbook;
            $physical = $physical || $isPrint || ! $isEbook;
        }

        return ['physical' => $physical || ! $ebook, 'ebook' => $ebook];
    }

    // =====================================================================
    // Tanda tangan
    // =====================================================================

    /**
     * Data diri penanda tangan dari Data Pribadi (dikunci saat tanda tangan).
     *
     * @return array{name: string, nik: string, address: string, phone: string}
     */
    public function identity(User $user): array
    {
        $profile = $user->personalProfile;
        $data = [
            'name' => $user->name,
            'nik' => trim((string) $profile?->nik),
            'address' => trim((string) ($profile?->ktp_address ?: $profile?->domicile_address)),
            'phone' => trim((string) $profile?->phone),
        ];

        $labels = ['nik' => 'NIK', 'address' => 'Alamat', 'phone' => 'No. HP'];
        $missing = array_keys(array_filter($labels, fn ($label, $key) => $data[$key] === '', ARRAY_FILTER_USE_BOTH));

        if ($missing !== []) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => 'Lengkapi Data Pribadi Anda dulu ('.implode(', ', array_map(fn ($key) => $labels[$key], $missing)).') sebelum menandatangani MOU.',
                'missing' => $missing,
            ], 422));
        }

        return $data;
    }

    /**
     * Cara user ini menandatangani MOU: 'isbn' (penulis pertama paket biasa,
     * bersama surat ISBN), 'final_review' (Book Chapter, saat menyetujui
     * naskah akhir) atau 'direct' (halaman MOU).
     */
    public function signVia(Mou $mou, User $user): string
    {
        if ($mou->type === Mou::TYPE_CHAPTER) {
            // Naskah gabungan sudah selesai (mis. sebelum fitur ini ada):
            // tanda tangan langsung dari halaman MOU.
            return Book::find($mou->book_id)?->compilation?->status === 'completed' ? 'direct' : 'final_review';
        }

        return $mou->signatories->sortBy('position')->first()?->user_id === $user->id ? 'isbn' : 'direct';
    }

    /** Alasan user belum bisa menandatangani lewat jalur $via, atau null. */
    public function blockedReason(Mou $mou, User $user, string $via): ?string
    {
        $signatory = $mou->signatories->firstWhere('user_id', $user->id);

        return match (true) {
            $signatory === null => 'Anda bukan penulis dalam MOU ini.',
            $signatory->signed_at !== null => 'Anda sudah menandatangani MOU ini.',
            $mou->status !== Mou::STATUS_PENDING => 'MOU ini sudah tidak menunggu tanda tangan.',
            $this->signVia($mou, $user) !== $via => match ($this->signVia($mou, $user)) {
                'isbn' => 'Penulis pertama menandatangani MOU sekalian dengan surat permohonan ISBN.',
                'final_review' => 'MOU Book Chapter disetujui saat Anda menyetujui naskah akhir.',
                default => 'MOU ini ditandatangani dari halaman MOU.',
            },
            $mou->type === Mou::TYPE_REGULAR && $via === 'direct'
                && $mou->content['distribution_mode'] === 'one' && ! $mou->distribution_choice => 'Menunggu penulis pertama memilih hak distribusi dan menandatangani MOU.',
            $mou->type === Mou::TYPE_CHAPTER && $mou->content['distribution_mode'] === 'one' && ! $mou->distribution_choice => 'Menunggu admin menetapkan hak distribusi buku.',
            default => null,
        };
    }

    /**
     * @param  list<string>|null  $choice  hak distribusi pilihan penulis pertama (mode "pilih salah satu")
     */
    public function sign(Mou $mou, User $user, string $png, string $via, ?array $choice = null): Mou
    {
        $mou = $this->sync($mou);

        if ($reason = $this->blockedReason($mou, $user, $via)) {
            abort(422, $reason);
        }

        $chooses = $via === 'isbn' && $mou->content['distribution_mode'] === 'one';

        if ($chooses) {
            $keys = array_column($mou->content['distribution_options'], 'key');
            abort_unless(is_array($choice) && count($choice) === 1 && in_array($choice[0], $keys, true), 422, 'Pilih satu hak distribusi buku.');
        }

        $identity = $this->identity($user);
        $path = 'mou/signatures/'.$mou->id.'-'.$user->id.'-'.Str::random(8).'.png';
        Storage::disk('local')->put($path, $png);

        DB::transaction(function () use ($mou, $user, $identity, $path, $chooses, $choice) {
            if ($chooses) {
                $mou->update(['distribution_choice' => array_values($choice)]);
            }

            $mou->signatories()->where('user_id', $user->id)->update([
                'identity' => json_encode($identity),
                'agreed_at' => now(),
                'signed_at' => now(),
                'signature_path' => $path,
            ]);

            if ($mou->signatories()->whereNull('signed_at')->doesntExist()) {
                $mou->update(['status' => Mou::STATUS_SIGNED, 'signed_at' => now()]);
            }
        });

        $mou->refresh()->load('signatories.user');

        if ($mou->status === Mou::STATUS_SIGNED) {
            $this->notifier->guard(fn () => $this->notifier->notifyAdmins(
                'admin_mou',
                'MOU siap ditandatangani penerbit',
                $mou->title.' — semua penulis sudah menandatangani.',
                '/admin/mou',
                ['subject_type' => 'mou', 'subject_id' => $mou->id]
            ));
        }

        return $mou;
    }

    /** Admin menyesuaikan isi MOU satu judul (bukan template utama). */
    public function customize(Mou $mou, array $content, array $royalties, ?array $choice, bool $resetSignatures, User $by): Mou
    {
        $signed = $mou->signatories()->whereNotNull('signed_at')->exists();

        abort_if($mou->status === Mou::STATUS_COMPLETED, 422, 'MOU yang sudah bermeterai tidak dapat diubah. Gunakan adendum.');
        abort_if($signed && ! $resetSignatures, 422, 'Sudah ada penulis yang menandatangani. Ubah hanya dengan membatalkan semua tanda tangan.');

        DB::transaction(function () use ($mou, $content, $royalties, $choice, $signed, $by) {
            if ($signed) {
                foreach ($mou->signatories()->whereNotNull('signature_path')->pluck('signature_path') as $path) {
                    Storage::disk('local')->delete($path);
                }

                $mou->signatories()->update(['signed_at' => null, 'agreed_at' => null, 'signature_path' => null, 'identity' => null]);
            }

            $mou->update([
                'content' => $content,
                'distribution_choice' => $content['distribution_mode'] === 'all'
                    ? array_column($content['distribution_options'], 'key')
                    : $choice,
                'customized' => true,
                'status' => Mou::STATUS_PENDING,
                'signed_at' => null,
                'updated_by' => $by->id,
            ]);

            foreach ($royalties as $userId => $values) {
                $mou->signatories()->where('user_id', $userId)->update([
                    'royalty_physical' => $content['royalty_types']['physical'] ? $values['physical'] : null,
                    'royalty_ebook' => $content['royalty_types']['ebook'] ? $values['ebook'] : null,
                ]);
            }
        });

        if ($signed) {
            $this->notifier->guard(fn () => $this->notifier->notify(
                $mou->signatories()->with('user')->get()->pluck('user')->filter(),
                'mou',
                'MOU diperbarui, mohon tanda tangan ulang',
                $mou->title,
                "/dashboard/mou/{$mou->id}",
                ['subject_type' => 'mou', 'subject_id' => $mou->id, 'email' => true]
            ));
        }

        return $mou->fresh('signatories.user');
    }

    /** Kembali mengikuti template utama (hanya sebelum ada tanda tangan). */
    public function resetToTemplate(Mou $mou): Mou
    {
        abort_if($mou->signatories()->whereNotNull('signed_at')->exists(), 422, 'Sudah ada penulis yang menandatangani.');

        $mou->update(['customized' => false]);

        return $this->sync($mou->fresh());
    }

    // =====================================================================
    // Gerbang penerbitan
    // =====================================================================

    public function isBindingForManuscript(Manuscript $manuscript): bool
    {
        return (bool) $this->forManuscript($manuscript)?->isBinding();
    }

    public function isBindingForBook(Book $book): bool
    {
        return (bool) $this->forBook($book)?->isBinding();
    }

    /**
     * Proyek Book Chapter (alur naskah gabungan) baru boleh diterbitkan
     * setelah semua penulis bab menyetujui MOU.
     */
    public function assertCanPublishChapterBook(Book $book): void
    {
        if ($book->is_active || ! $book->is_chapter_offering || ! $book->compilation()->exists()) {
            return;
        }

        abort_unless(
            $this->isBindingForBook($book),
            422,
            'Semua penulis bab harus menyetujui MOU distribusi buku (saat menyetujui naskah akhir) sebelum buku diterbitkan.'
        );
    }

    // =====================================================================
    // Tampilan
    // =====================================================================

    /** @return array<string, mixed> */
    public function present(Mou $mou, ?User $viewer = null, bool $admin = false): array
    {
        $mou->loadMissing(['signatories.user', 'addenda']);
        $content = $this->filledContent($mou);
        $signatory = $viewer ? $mou->signatories->firstWhere('user_id', $viewer->id) : null;
        $via = $viewer && $signatory ? $this->signVia($mou, $viewer) : null;

        $isbnApplicationId = $mou->type === Mou::TYPE_REGULAR && $mou->manuscript_id
            ? IsbnApplication::where('manuscript_id', $mou->manuscript_id)->value('id')
            : null;

        return [
            'id' => $mou->id,
            'type' => $mou->type,
            'type_label' => MouTemplate::CATEGORY_LABELS[$mou->type],
            'number' => $mou->number,
            'title' => $mou->title,
            'status' => $mou->status,
            'status_label' => Mou::STATUS_LABELS[$mou->status],
            'signed_at' => $mou->signed_at?->toIso8601String(),
            'customized' => $mou->customized,
            'manuscript_id' => $mou->manuscript_id,
            'book_id' => $mou->book_id,
            'isbn_application_id' => $isbnApplicationId,
            // Book Chapter: halaman naskah gabungan tempat MOU disetujui.
            'compilation_manuscript_id' => $mou->type === Mou::TYPE_CHAPTER && $mou->book_id
                ? Manuscript::where('compiled_book_id', $mou->book_id)->value('id')
                : null,
            'content' => $content,
            'distribution_choice' => $mou->distribution_choice ?? [],
            'publisher' => $this->publisher(),
            'signatories' => $mou->signatories->map(fn (MouSignatory $row) => [
                'user_id' => $row->user_id,
                'name' => $row->identity['name'] ?? $row->user?->name,
                'position' => $row->position,
                'chapters' => $row->chapters,
                'royalty_physical' => $row->royalty_physical,
                'royalty_ebook' => $row->royalty_ebook,
                'signed_at' => $row->signed_at?->toIso8601String(),
                'is_me' => $viewer !== null && $row->user_id === $viewer->id,
            ])->values()->all(),
            'has_final' => $mou->final_pdf_path !== null,
            'final_uploaded_at' => $mou->final_uploaded_at?->toIso8601String(),
            'addenda' => $mou->addenda->map(fn ($addendum) => [
                'id' => $addendum->id,
                'title' => $addendum->title,
                'note' => $addendum->note,
                'file_name' => $addendum->file_name,
                'created_at' => $addendum->created_at?->toIso8601String(),
            ])->values()->all(),
            'me' => $signatory ? [
                'signed' => $signatory->signed_at !== null,
                'signed_at' => $signatory->signed_at?->toIso8601String(),
                'sign_via' => $via,
                'blocked_reason' => $signatory->signed_at ? null : $this->blockedReason($mou, $viewer, $via),
                'chooses_distribution' => $via === 'isbn' && $content['distribution_mode'] === 'one',
            ] : null,
            ...($admin ? ['template_content' => MouTemplate::current($mou->type)->snapshot()] : []),
        ];
    }

    /** Isi MOU dengan penanda {judul}/{penerbit} sudah diganti. @return array<string, mixed> */
    public function filledContent(Mou $mou): array
    {
        $replace = ['{judul}' => $mou->title, '{penerbit}' => $this->publisher()['name']];
        $fill = fn ($value) => is_string($value) ? strtr($value, $replace) : $value;
        $content = $mou->content;

        foreach (['title', 'opening', 'contact_note'] as $key) {
            $content[$key] = $fill($content[$key] ?? '');
        }

        foreach (['first_party_terms', 'second_party_terms', 'closing_terms'] as $key) {
            $content[$key] = array_map($fill, $content[$key] ?? []);
        }

        $content['distribution_options'] = array_map(
            fn (array $option) => ['key' => $option['key'], 'name' => $fill($option['name']), 'description' => $fill($option['description'] ?? '')],
            $content['distribution_options'] ?? []
        );

        return $content;
    }

    /** @return array{name: string, address: string, responsible_name: string, city: string} */
    public function publisher(): array
    {
        $settings = IsbnLetterSetting::current();

        return [
            'name' => $settings->publisher_name,
            'address' => $settings->publisher_address,
            'responsible_name' => $settings->responsible_name,
            'city' => $settings->city,
        ];
    }

    /** PDF MOU; $sealed = dengan tanda tangan + stempel penerbit (khusus admin). */
    public function pdf(Mou $mou, bool $sealed): string
    {
        return (new MouRenderer)->render($mou->loadMissing('signatories.user'), $this->filledContent($mou), $sealed);
    }

    /** Waktu Indonesia Barat untuk ditampilkan di MOU. */
    public static function wib(Carbon $time): string
    {
        return $time->copy()->timezone('Asia/Jakarta')->format('d-m-Y H.i').' WIB';
    }

    // =====================================================================

    private function subjectTitle(Mou $mou): ?string
    {
        return $mou->type === Mou::TYPE_CHAPTER
            ? Book::whereKey($mou->book_id)->value('title')
            : Manuscript::whereKey($mou->manuscript_id)->value('title');
    }

    /** @return Collection<int, User> */
    private function manuscriptAuthors(Manuscript $manuscript): Collection
    {
        $linked = $manuscript->authorLinks->sortBy('position')->pluck('user')->filter()->unique('id')->values();

        return $linked->isNotEmpty() ? $linked : collect([$manuscript->user])->filter()->values();
    }
}
