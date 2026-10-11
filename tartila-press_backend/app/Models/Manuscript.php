<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Manuscript extends Model
{
    /*
    | Cara editor mendapatkan naskah (kolom editor_source).
    */

    public const EDITOR_SOURCE_ADMIN = 'admin';

    public const EDITOR_SOURCE_POOL = 'pool';

    public const EDITOR_SOURCE_AUTHOR = 'author';

    public const EDITOR_SOURCE_PROJECT_OWNER = 'project_owner';

    protected $fillable = [
        'order_id',
        'user_id',
        'title',
        'authors',
        'status',
        'editor_id',
        'editor_source',
        'editor_fee',
        'editor_requested_fee',
        'editor_deadline',
        'editor_assignment_note',
        'open_for_claim',
        'author_bio_photo',
        'author_bio_name',
        'author_bio_text',
        'manuscript_template_id',
        'compiled_book_id',
        'difficulty',
        'pool_field_category_ids',
    ];

    /*
    | Tingkat kesulitan naskah (diisi admin saat menerima naskah penulis).
    */

    public const DIFFICULTIES = [
        'mudah' => 'Mudah',
        'sedang' => 'Sedang',
        'sulit' => 'Sulit',
    ];

    /*
    | Status khusus bab Book Chapter: bab disetujui admin menunggu bab lain,
    | lalu digabung menjadi satu naskah buku yang dikerjakan editor.
    */

    public const STATUS_AWAITING_COMPILATION = 'awaiting_compilation';

    public const STATUS_COMPILED = 'compiled';

    protected $appends = [
        'editor_admin_fee',
    ];

    protected function casts(): array
    {
        return [
            'authors' => 'array',
            'editor_fee' => 'decimal:2',
            'editor_requested_fee' => 'decimal:2',
            'editor_deadline' => 'date',
            'open_for_claim' => 'boolean',
            'pool_field_category_ids' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(ManuscriptRevision::class)
            ->orderBy('revision_number');
    }

    public function latestRevision(): ?ManuscriptRevision
    {
        // reorder: relasi revisions sudah diurutkan naik.
        return $this->revisions()->reorder('revision_number', 'desc')->first();
    }

    public function book(): HasOne
    {
        return $this->hasOne(Book::class);
    }

    public function bookChapter(): HasOne
    {
        return $this->hasOne(BookChapter::class);
    }

    /** Surat permohonan ISBN naskah ini (paket biasa), kalau sudah dibuka. */
    public function isbnApplication(): HasOne
    {
        return $this->hasOne(IsbnApplication::class);
    }

    /** MOU distribusi buku (paket biasa). */
    public function mou(): HasOne
    {
        return $this->hasOne(Mou::class);
    }

    /** Buku Book Chapter yang bab-babnya digabung menjadi naskah ini. */
    public function compiledBook(): BelongsTo
    {
        return $this->belongsTo(Book::class, 'compiled_book_id');
    }

    public function isCompilation(): bool
    {
        return $this->compiled_book_id !== null;
    }

    /** Catatan revisi bab ini dari editor/admin naskah gabungan. */
    public function chapterRevisionRequests(): HasMany
    {
        return $this->hasMany(ChapterRevisionRequest::class)->latest();
    }

    public function authorLinks(): HasMany
    {
        return $this->hasMany(ManuscriptAuthor::class)->orderBy('position');
    }

    protected function coAuthors(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->authorLinks->map(fn (ManuscriptAuthor $link) => [
                'id' => $link->user_id,
                'name' => $link->user?->name,
                'has_approved' => $link->approved_at !== null,
            ])->all(),
        );
    }

    /**
     * Bagian fee editor yang ditetapkan admin. editor_fee adalah total:
     * fee permintaan editor (hanya bila dipilih langsung penulis) + fee dari
     * admin. Untuk sumber lain seluruh editor_fee adalah dari admin.
     */
    protected function editorAdminFee(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->editor_fee === null
                ? null
                : round($this->editor_fee - ($this->editor_requested_fee ?? 0), 2),
        );
    }

    /**
     * Biodata penulis untuk akhir buku — pakai override kalau ada,
     * fallback ke data profil publik penulis.
     */
    public function resolvedAuthorBio(): array
    {
        $publicProfile = $this->user->publicProfile;

        return [
            'photo' => $this->author_bio_photo
                ?: $publicProfile?->profile_photo,
            'name' => $this->author_bio_name
                ?: ($publicProfile?->pen_name ?: $this->user->name),
            'bio' => $this->author_bio_text
                ?: $publicProfile?->bio,
        ];
    }
}
