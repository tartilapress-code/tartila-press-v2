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
            // Urutan tetap: transaksi bersamaan mengunci baris dalam urutan yang sama (tanpa deadlock).
            ->sort()
            ->values();

        if ($pages->isEmpty()) {
            return ['recorded' => 0, 'counted' => 0];
        }

        $counted = ! $this->access->isAuthor($user, $readerBook);
        $today = self::today();
        $recorded = 0;
        $newEvents = 0;

        DB::transaction(function () use ($user, $readerBook, $pages, $counted, $today, &$recorded, &$newEvents) {
            $recorded = 0;
            $newEvents = 0;
            $newPages = [];

            foreach ($pages as $page) {
                $inserted = DB::table('reader_page_reads')->insertOrIgnore([
                    'reader_book_id' => $readerBook->id,
                    'user_id' => $user->id,
                    'page' => $page,
                    'read_date' => $today,
                    'counted' => $counted,
                    'created_at' => now(),
                ]);

                if ($inserted > 0) {
                    $recorded++;
                    $newPages[] = $page;
                }
            }

            if (! $counted || $newPages === []) {
                return;
            }

            $newEvents = count($newPages);

            // Halaman yang sudah pernah dibaca pembaca ini di hari lain tidak menambah "pembaca berbeda".
            $seenBefore = DB::table('reader_page_reads')
                ->where('reader_book_id', $readerBook->id)
                ->where('user_id', $user->id)
                ->whereIn('page', $newPages)
                ->where('counted', true)
                ->where('read_date', '<>', $today)
                ->pluck('page')
                ->flip();

            $maxReaders = 0;

            foreach ($newPages as $page) {
                $maxReaders = max($maxReaders, $this->bump($readerBook->id, $page, ! isset($seenBefore[$page])));
            }

            // Urutan kunci: ringkasan halaman -> buku -> ringkasan harian (sama di semua transaksi).
            DB::table('reader_books')->where('id', $readerBook->id)->increment('read_events', $newEvents);

            if ($maxReaders > 0) {
                DB::table('reader_books')
                    ->where('id', $readerBook->id)
                    ->where('top_page_readers', '<', $maxReaders)
                    ->update(['top_page_readers' => $maxReaders]);
            }

            // Ringkasan harian untuk laporan royalti per rentang tanggal.
            DB::table('reader_daily_reads')->insertOrIgnore(['reader_book_id' => $readerBook->id, 'read_date' => $today, 'events' => 0]);
            DB::table('reader_daily_reads')->where(['reader_book_id' => $readerBook->id, 'read_date' => $today])->increment('events', $newEvents);
        }, 3); // deadlock InnoDB pada beban tinggi: ulangi sampai 3 kali

        return ['recorded' => $recorded, 'counted' => $newEvents];
    }

    /**
     * Tambah ringkasan satu halaman. Mengembalikan jumlah pembaca berbeda halaman itu bila ada
     * pembaca baru (untuk rekor angka publik), selain itu 0.
     */
    private function bump(int $readerBookId, int $page, bool $newReader): int
    {
        $where = ['reader_book_id' => $readerBookId, 'page' => $page];

        DB::table('reader_page_stats')->insertOrIgnore($where + ['readers' => 0, 'events' => 0]);

        DB::table('reader_page_stats')->where($where)->update([
            'events' => DB::raw('events + 1'),
            ...($newReader ? ['readers' => DB::raw('readers + 1')] : []),
        ]);

        return $newReader ? (int) DB::table('reader_page_stats')->where($where)->value('readers') : 0;
    }
}
