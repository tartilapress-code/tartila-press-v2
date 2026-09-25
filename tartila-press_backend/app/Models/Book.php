<?php

namespace App\Models;

use App\Casts\LanguageList;
use App\Support\AuthorNames;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Book extends Model
{
    /**
     * Panjang minimum deskripsi (karakter) agar dianggap abstrak lengkap oleh
     * halaman abstrak untuk Google Scholar.
     */
    public const SCHOLAR_MIN_ABSTRACT_LENGTH = 100;

    protected static function booted(): void
    {
        static::creating(function (Book $book) {
            if (! $book->slug) {
                $book->slug = static::generateUniqueSlug($book->title);
            }
        });
    }

    protected $fillable = [
        'manuscript_id',
        'title',
        'slug',
        'authors',
        'authors_text',
        'isbn',
        'front_cover',
        'back_cover',
        'cover_layout_designer',
        'description',
        'about',
        'languages',
        'facilities',
        'services',
        'includes_hki',
        'includes_isbn_print',
        'includes_isbn_electronic',
        'book_category_id',
        'field_category_id',
        'price',
        'discount',
        'royalty_percentage',
        'preview_file',
        'citation_publisher',
        'citation_publication_date',
        'estimated_publish_date',
        'submission_deadline',
        'google_scholar_url',
        'is_chapter_compilation',
        'is_editor_created',
        'is_chapter_offering',
        'is_active',
        'created_by',
        'owner_editor_id',
    ];

    // Sama dengan default kolom, supaya buku yang baru dibuat langsung memuat
    // false (bukan null) di respons. `languages` berupa JSON mentah.
    protected $attributes = [
        'includes_hki' => false,
        'includes_isbn_print' => false,
        'includes_isbn_electronic' => false,
        'languages' => '[]',
    ];

    protected $appends = [
        'final_price',
        'preview_url',
        'editor_name',
    ];

    protected $hidden = [
        'royalty_percentage',
    ];

    protected function casts(): array
    {
        return [
            'authors' => 'array',
            'languages' => LanguageList::class,
            'facilities' => 'array',
            'services' => 'array',
            'price' => 'decimal:2',
            'discount' => 'integer',
            'royalty_percentage' => 'decimal:2',
            'citation_publication_date' => 'date',
            'estimated_publish_date' => 'date',
            'submission_deadline' => 'datetime',
            'is_chapter_compilation' => 'boolean',
            'is_editor_created' => 'boolean',
            'is_chapter_offering' => 'boolean',
            'includes_hki' => 'boolean',
            'includes_isbn_print' => 'boolean',
            'includes_isbn_electronic' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected function finalPrice(): Attribute
    {
        return Attribute::make(
            get: fn () => round(
                $this->price - ($this->price * $this->discount / 100),
                2
            ),
        );
    }

    protected function previewUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->preview_file
                ? Storage::disk('public')->url($this->preview_file)
                : null,
        );
    }

    protected function editorName(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->manuscript?->editor?->name ?? $this->ownerEditor?->name,
        );
    }

    /**
     * Nama + slug profil publik editor buku ini (kalau ada), untuk dijadikan
     * link ke halaman profil publik. Sumbernya sama seperti editorName().
     */
    protected function editorProfile(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->toProfileRef($this->manuscript?->editor ?? $this->ownerEditor),
        );
    }

    /**
     * Nama + slug profil publik tiap penulis buku ini (kalau ada), untuk
     * dijadikan link ke halaman profil publik. Pakai co-author yang
     * terhubung akun (manuscript_authors) kalau ada, fallback ke pemilik
     * naskah tunggal untuk naskah lama sebelum fitur co-author.
     */
    protected function authorProfiles(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->manuscript) {
                    return [];
                }

                $users = $this->manuscript->authorLinks->isNotEmpty()
                    ? $this->manuscript->authorLinks->pluck('user')
                    : collect([$this->manuscript->user]);

                return $users->filter()
                    ->map(fn (User $user) => $this->toProfileRef($user))
                    ->values()
                    ->all();
            },
        );
    }

    /**
     * Nama penulis untuk metadata sitasi (citation_author): gelar dibuang dan
     * nama ganda disatukan. Sumbernya daftar penulis buku, lalu teks penulis,
     * lalu nama penulis dari profil naskah.
     */
    protected function citationAuthors(): Attribute
    {
        return Attribute::make(
            get: function () {
                $names = AuthorNames::fromList($this->authors ?? []);

                if ($names === []) {
                    $names = AuthorNames::fromText($this->authors_text);
                }

                if ($names === []) {
                    $names = AuthorNames::fromList(
                        array_map(fn (array $author) => $author['name'] ?? '', $this->author_profiles)
                    );
                }

                return $names;
            },
        );
    }

    /**
     * Data minimum agar halaman abstrak layak diindeks Google Scholar: aktif,
     * berjudul, punya minimal satu penulis, tanggal terbit, dan abstrak (deskripsi)
     * yang cukup panjang.
     */
    public function isScholarReady(): bool
    {
        return $this->is_active
            && filled($this->title)
            && $this->citation_authors !== []
            && $this->citation_publication_date !== null
            && mb_strlen(trim((string) $this->description)) >= self::SCHOLAR_MIN_ABSTRACT_LENGTH;
    }

    /**
     * Penyaring kasar di database untuk buku yang mungkin siap Scholar; syarat
     * lengkapnya (mis. penulis) dicek per buku lewat isScholarReady().
     */
    public function scopeScholarCandidates(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->whereNotNull('citation_publication_date')
            ->whereNotNull('description')
            ->whereRaw('LENGTH(description) >= ?', [self::SCHOLAR_MIN_ABSTRACT_LENGTH]);
    }

    /**
     * Buku aktif (ada di katalog) dengan user ini sebagai salah satu penulis -
     * baik buku tunggal/multi-penulis (lewat Manuscript) maupun buku
     * kompilasi Book Chapter (lewat salah satu bab yang naskahnya ditulis
     * user ini).
     */
    public function scopePublishedByAuthor(Builder $query, int $userId): Builder
    {
        $isAuthor = function ($query) use ($userId) {
            $query->where('user_id', $userId)
                ->orWhereHas('authorLinks', fn ($q) => $q->where('user_id', $userId));
        };

        return $query->where('is_active', true)
            ->where(function ($query) use ($isAuthor) {
                $query->whereHas('manuscript', $isAuthor)
                    ->orWhereHas('chapters.manuscript', $isAuthor);
            });
    }

    /**
     * Buku aktif (ada di katalog) yang diedit oleh user ini - lewat naskah
     * tunggal/bab yang editor_id-nya user ini, atau proyek Book Chapter yang
     * dia miliki (owner_editor_id).
     */
    public function scopePublishedByEditor(Builder $query, int $userId): Builder
    {
        $isEditor = function ($query) use ($userId) {
            $query->where('editor_id', $userId);
        };

        return $query->where('is_active', true)
            ->where(function ($query) use ($isEditor, $userId) {
                $query->whereHas('manuscript', $isEditor)
                    ->orWhereHas('chapters.manuscript', $isEditor)
                    ->orWhere('owner_editor_id', $userId);
            });
    }

    public static function generateUniqueSlug(string $title): string
    {
        $baseSlug = Str::slug($title) ?: 'buku';
        $slug = $baseSlug;
        $counter = 1;

        while (static::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    private function toProfileRef(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'name' => $user->name,
            'public_profile' => $user->publicProfile ? [
                'slug' => $user->publicProfile->slug,
                'pen_name' => $user->publicProfile->pen_name,
                'is_published' => $user->publicProfile->is_published,
            ] : null,
        ];
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(BookCategory::class, 'book_category_id');
    }

    public function fieldCategory(): BelongsTo
    {
        return $this->belongsTo(FieldCategory::class, 'field_category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function ownerEditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_editor_id');
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(BookChapter::class)
            ->orderBy('chapter_number');
    }

    /**
     * Fasilitas & layanan (item paket custom) yang dicentang untuk proyek
     * Book Chapter ini.
     */
    public function packageItems(): BelongsToMany
    {
        return $this->belongsToMany(CustomPackageItem::class, 'book_package_items')
            ->orderBy('type')
            ->orderBy('name');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(BookReview::class);
    }

    public function externalSales(): HasMany
    {
        return $this->hasMany(BookExternalSale::class);
    }

    public function orderItems(): MorphMany
    {
        return $this->morphMany(OrderItem::class, 'itemable');
    }

    public function isFull(): bool
    {
        return $this->chapters->every(fn (BookChapter $chapter) => $chapter->manuscript_id !== null);
    }
}
