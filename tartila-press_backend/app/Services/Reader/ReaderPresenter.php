<?php

namespace App\Services\Reader;

use App\Models\Reader\ReaderBook;
use App\Models\User;
use App\Support\Languages;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Bentuk buku Tartila Book untuk respons API (katalog, detail, admin). */
class ReaderPresenter
{
    public const LANGUAGE_LABELS = [
        'id' => 'Indonesia', 'en' => 'Inggris', 'ms' => 'Melayu', 'ar' => 'Arab',
        'jv' => 'Jawa', 'su' => 'Sunda', 'min' => 'Minang', 'ban' => 'Bali',
        'zh' => 'Mandarin', 'ja' => 'Jepang', 'ko' => 'Korea', 'hi' => 'Hindi',
        'th' => 'Thailand', 'vi' => 'Vietnam', 'fa' => 'Persia', 'tr' => 'Turki',
        'de' => 'Jerman', 'fr' => 'Prancis', 'nl' => 'Belanda', 'es' => 'Spanyol',
        'pt' => 'Portugis', 'it' => 'Italia', 'ru' => 'Rusia',
    ];

    /** Relasi yang harus dimuat sebelum present(). */
    public const RELATIONS = ['book', 'educationField', 'category', 'genre'];

    public function __construct(private readonly ReaderAccessService $access) {}

    /**
     * @param  Collection<int, ReaderBook>  $books
     * @return Collection<int, array<string, mixed>>
     */
    public function many(Collection $books, ?User $user = null, bool $detail = false): Collection
    {
        $free = $this->access->freeNowMap($books);
        $liked = $saved = $progress = [];

        if ($user && $books->isNotEmpty()) {
            $ids = $books->pluck('id');
            $liked = DB::table('reader_likes')->where('user_id', $user->id)->whereIn('reader_book_id', $ids)->pluck('reader_book_id')->flip()->all();
            $saved = DB::table('reader_saves')->where('user_id', $user->id)->whereIn('reader_book_id', $ids)->pluck('reader_book_id')->flip()->all();
            $progress = DB::table('reader_progress')->where('user_id', $user->id)->whereIn('reader_book_id', $ids)->pluck('last_page', 'reader_book_id')->all();
        }

        return $books->map(function (ReaderBook $readerBook) use ($user, $free, $liked, $saved, $progress, $detail) {
            $data = $this->base($readerBook, $free[$readerBook->id] ?? false);

            if ($user) {
                $data['me'] = [
                    'liked' => isset($liked[$readerBook->id]),
                    'saved' => isset($saved[$readerBook->id]),
                    'last_page' => $progress[$readerBook->id] ?? null,
                    'access' => $detail ? $this->access->evaluate($user, $readerBook) : null,
                ];
            }

            return $data;
        });
    }

    /** @return array<string, mixed> */
    public function one(ReaderBook $readerBook, ?User $user = null): array
    {
        $readerBook->loadMissing(self::RELATIONS);
        $data = $this->many(collect([$readerBook]), $user, detail: true)->first();

        $data['book']['description'] = $readerBook->book->description;
        $data['book']['about'] = $readerBook->book->about;
        $data['book']['isbn'] = $readerBook->book->isbn;
        $data['can_read_now'] = $user ? ($data['me']['access']['allowed'] ?? false) : false;

        return $data;
    }

    /** @return array<string, mixed> */
    private function base(ReaderBook $readerBook, bool $freeNow): array
    {
        $book = $readerBook->book;

        return [
            'id' => $readerBook->id,
            'book' => [
                'title' => $book->title,
                'authors' => $book->authors_text ?: implode(', ', (array) $book->authors),
                'cover' => $book->front_cover,
            ],
            'pustaka' => $readerBook->pustaka,
            'pustaka_label' => ReaderBook::PUSTAKA[$readerBook->pustaka] ?? $readerBook->pustaka,
            'education_field' => $readerBook->educationField?->name,
            'category' => $readerBook->category?->name,
            'genre' => $readerBook->genre?->name,
            'age_limit' => $readerBook->age_limit,
            'age_label' => ReaderBook::AGE_LIMITS[$readerBook->age_limit] ?? $readerBook->age_limit,
            'language' => $readerBook->language,
            'language_label' => self::LANGUAGE_LABELS[$readerBook->language] ?? $readerBook->language,
            'page_count' => $readerBook->page_count,
            'price' => $readerBook->price,
            'access_days' => $readerBook->access_days,
            'free_now' => $freeNow,
            // Jumlah pembaca terbanyak pada satu halaman.
            'top_page_readers' => $readerBook->top_page_readers,
            'likes_count' => (int) ($readerBook->likes_count ?? 0),
            'saves_count' => (int) ($readerBook->saves_count ?? 0),
            'comments_count' => (int) ($readerBook->comments_count ?? 0),
            'version' => $readerBook->version,
            'updated_at' => $readerBook->file_updated_at?->toIso8601String(),
        ];
    }

    /** Pilihan filter katalog (bahasa dari buku yang tampil). @return list<string> */
    public static function languageCodes(): array
    {
        return Languages::CODES;
    }
}
