<?php

namespace App\Services\Reader;

use App\Models\Reader\ReaderBook;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Hitungan baca per halaman.
 *
 * Satu pembaca membuka satu halaman pada satu hari (tanggal WIB) dihitung 1;
 * membuka lagi di hari yang sama tetap 1, di hari lain +1. Membuka banyak
 * halaman menambah hitungan sebanyak halaman itu. Bacaan penulis buku itu
 * sendiri disimpan tapi tidak dihitung (tidak masuk royalti maupun angka publik).
 *
 * Angka publik = jumlah pembaca terbanyak pada satu halaman. Royalti baca
 * memakai jumlah semua bacaan (user-halaman-hari).
 */
class ReaderReadingService
{
    public const MAX_PAGES_PER_CALL = 40;

    public function __construct(private readonly ReaderAccessService $access) {}

    public static function today(): string
    {
        return now('Asia/Jakarta')->toDateString();
    }

    /**
     * @param  list<int>  $pages
     * @return array{recorded: int, counted: int}
     */
    public function record(User $user, ReaderBook $readerBook, array $pages): array
    {
        $pages = collect($pages)
            ->map(fn ($page) => (int) $page)
            ->filter(fn (int $page) => $page >= 1 && $page <= $readerBook->page_count)
            ->unique()
            ->take(self::MAX_PAGES_PER_CALL)
            ->values();

        if ($pages->isEmpty()) {
            return ['recorded' => 0, 'counted' => 0];
        }

        $counted = ! $this->access->isAuthor($user, $readerBook);
        $today = self::today();
        $recorded = 0;
        $newEvents = 0;

        DB::transaction(function () use ($user, $readerBook, $pages, $counted, $today, &$recorded, &$newEvents) {
            foreach ($pages as $page) {
                $inserted = DB::table('reader_page_reads')->insertOrIgnore([
                    'reader_book_id' => $readerBook->id,
                    'user_id' => $user->id,
                    'page' => $page,
                    'read_date' => $today,
                    'counted' => $counted,
                    'created_at' => now(),
                ]);

                if ($inserted === 0) {
                    continue;
                }

                $recorded++;

                if (! $counted) {
                    continue;
                }

                $newEvents++;
                $firstTime = ! DB::table('reader_page_reads')
                    ->where('reader_book_id', $readerBook->id)
                    ->where('user_id', $user->id)
                    ->where('page', $page)
                    ->where('counted', true)
                    ->where('read_date', '<>', $today)
                    ->exists();

                $this->bump($readerBook->id, $page, $firstTime);
            }

            if ($newEvents > 0) {
                DB::table('reader_books')->where('id', $readerBook->id)->increment('read_events', $newEvents);
            }
        });

        return ['recorded' => $recorded, 'counted' => $newEvents];
    }

    /** Tambah ringkasan satu halaman; naikkan angka publik bila ada rekor baru. */
    private function bump(int $readerBookId, int $page, bool $newReader): void
    {
        $where = ['reader_book_id' => $readerBookId, 'page' => $page];

        DB::table('reader_page_stats')->insertOrIgnore($where + ['readers' => 0, 'events' => 0]);

        DB::table('reader_page_stats')->where($where)->update([
            'events' => DB::raw('events + 1'),
            ...($newReader ? ['readers' => DB::raw('readers + 1')] : []),
        ]);

        if ($newReader) {
            $readers = (int) DB::table('reader_page_stats')->where($where)->value('readers');

            DB::table('reader_books')
                ->where('id', $readerBookId)
                ->where('top_page_readers', '<', $readers)
                ->update(['top_page_readers' => $readers]);
        }
    }
}
