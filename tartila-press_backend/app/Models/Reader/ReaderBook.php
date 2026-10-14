<?php

namespace App\Models\Reader;

use App\Models\Book;
use App\Models\Scopes\ExcludePartnerBooks;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Satu buku terbit di Tartila Book: klasifikasi, harga dan hitungan baca.
 * Judul, penulis, sampul, deskripsi DAN berkas ebook (PDF) diambil dari buku
 * di Tartila Press (ebook diunggah admin di sana, sekali saja).
 */
class ReaderBook extends Model
{
    public const PUSTAKA = ['fiksi' => 'Fiksi', 'non_fiksi' => 'Non fiksi'];

    public const AGE_LIMITS = [
        'all' => 'Semua umur',
        '7' => '7+',
        '13' => '13+',
        '17' => '17+',
        '21' => '21+',
    ];

    protected $fillable = [
        'book_id',
        'is_published',
        'pustaka',
        'education_field_id',
        'category_id',
        'genre_id',
        'age_limit',
        'language',
        'version',
        'price',
        'access_days',
        'purchase_royalty_percent',
        'read_fee',
    ];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'version' => 'integer',
            'price' => 'float',
            'access_days' => 'integer',
            'purchase_royalty_percent' => 'float',
            'read_fee' => 'float',
            'read_events' => 'integer',
            'top_page_readers' => 'integer',
        ];
    }

    /**
     * Tautan Tartila Book memakai judul buku (slug) atau nomor; ebook yang belum ada memberi
     * pesan yang jelas, bukan "tidak ditemukan".
     */
    public function resolveRouteBinding($value, $field = null): ?self
    {
        $query = $field === null && ! ctype_digit((string) $value)
            ? static::whereHas('book', fn ($book) => $book->where('slug', (string) $value))
            : static::where($field ?? $this->getRouteKeyName(), $value);

        return $query->first() ?? abort(404, 'Ebook belum tersedia, coba lagi di lain waktu.');
    }

    /** Buku induk, termasuk buku mitra (yang disembunyikan dari Tartila Press). */
    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class)->withoutGlobalScope(ExcludePartnerBooks::class);
    }

    public function educationField(): BelongsTo
    {
        return $this->belongsTo(ReaderTerm::class, 'education_field_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ReaderTerm::class, 'category_id');
    }

    public function genre(): BelongsTo
    {
        return $this->belongsTo(ReaderTerm::class, 'genre_id');
    }

    public function likedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'reader_likes', 'reader_book_id', 'user_id');
    }

    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'reader_saves', 'reader_book_id', 'user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ReaderComment::class);
    }

    /** Berkas ebook dibaca dari buku: ada PDF dengan jumlah halaman yang diketahui. */
    public function hasFile(): bool
    {
        return (bool) $this->book?->hasReadableEbook();
    }

    protected function filePath(): Attribute
    {
        return Attribute::get(fn () => $this->hasFile() ? $this->book->ebook_file : null);
    }

    protected function fileName(): Attribute
    {
        return Attribute::get(fn () => $this->hasFile() ? $this->book->ebook_name : null);
    }

    protected function fileSize(): Attribute
    {
        return Attribute::get(fn () => $this->hasFile() && Storage::disk('local')->exists($this->book->ebook_file)
            ? Storage::disk('local')->size($this->book->ebook_file)
            : null);
    }

    protected function pageCount(): Attribute
    {
        return Attribute::get(fn () => $this->hasFile() ? (int) $this->book->ebook_pages : 0);
    }

    protected function fileUpdatedAt(): Attribute
    {
        return Attribute::get(fn (): ?Carbon => $this->hasFile() ? $this->book->ebook_uploaded_at : null);
    }

    /**
     * Terlihat di katalog publik: dipublikasikan, ebook PDF ada di bukunya, dan bukunya aktif.
     * Buku mitra hanya tampil setelah disetujui admin (partner_status = approved).
     */
    public function scopeListed(Builder $query): Builder
    {
        return $query->where('is_published', true)
            ->whereHas('book', fn ($book) => $book->where('is_active', true)
                ->where(fn ($partner) => $partner->whereNull('partner_id')->orWhere('partner_status', 'approved'))
                ->whereNotNull('ebook_file')
                ->where('ebook_file', 'like', '%.pdf')
                ->where('ebook_pages', '>', 0));
    }
}
