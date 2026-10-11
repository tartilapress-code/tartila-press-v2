<?php

namespace App\Services\Reader;

use App\Models\Book;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderOrder;
use App\Models\Reader\ReaderSetting;
use App\Models\User;
use App\Services\BookRoyaltyService;
use App\Services\VoucherService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Royalti Tartila Book dengan dua sistem:
 *  1. Pembelian: persentase dari pembelian buku satuan yang dikonfirmasi.
 *  2. Bacaan: jumlah bacaan (user-halaman-hari, tanpa bacaan penulis) × biaya per bacaan.
 * Nilai tiap buku dibagi antar-penerima menurut bobot royalti ebook mereka
 * (MOU yang berlaku, atau aturan lama kalau belum ada MOU); kalau bobotnya
 * tidak ada, dibagi rata. Langganan tidak dibagi per pembelian; penghasilan
 * penulis dari langganan lewat sistem bacaan.
 *
 * Angka dihitung ulang dari pengaturan yang berlaku sekarang, jadi berubah
 * kalau persen/biaya bacaan diubah admin.
 */
class ReaderRoyaltyService
{
    public function __construct(
        private readonly BookRoyaltyService $royalty,
        private readonly VoucherService $vouchers,
    ) {}

    /**
     * Bobot pembagian royalti ebook per penerima (jumlah semua bobot = 1).
     *
     * @return list<array{user_id: int, name: string, weight: float}>
     */
    public function weights(Book $book): array
    {
        $byUser = [];

        foreach ($this->royalty->shares($book) as $share) {
            $id = (int) $share['user_id'];
            $byUser[$id] ??= ['user_id' => $id, 'name' => $share['name'], 'rate' => 0.0];
            $byUser[$id]['rate'] += (float) ($share['ebook_rate'] ?? $share['rate']);
        }

        $total = array_sum(array_column($byUser, 'rate'));

        if ($total <= 0) {
            $authors = $this->royalty->authors($book)->values();

            return $authors->map(fn (User $author) => [
                'user_id' => $author->id,
                'name' => $author->name,
                'weight' => 1 / max(1, $authors->count()),
            ])->all();
        }

        return array_values(array_map(fn (array $row) => [
            'user_id' => $row['user_id'],
            'name' => $row['name'],
            'weight' => $row['rate'] / $total,
        ], $byUser));
    }

    /**
     * @param  string  $from  tanggal WIB (Y-m-d)
     * @param  string  $to  tanggal WIB (Y-m-d)
     * @return Collection<int, array<string, mixed>> per buku, terbesar dulu
     */
    public function report(string $from, string $to, ?string $search = null, ?int $onlyAuthorId = null): Collection
    {
        $books = ReaderBook::with(['book' => fn ($q) => $q->with(BookRoyaltyService::SHARE_RELATIONS)])
            ->whereHas('book')
            ->when($search, function ($query) use ($search) {
                $term = '%'.mb_strtolower($search).'%';
                $query->whereHas('book', fn ($book) => $book->whereRaw('LOWER(title) LIKE ?', [$term]));
            })
            ->get();

        return $this->summaries($books, $from, $to)
            ->when($onlyAuthorId, fn (Collection $rows) => $rows
                ->filter(fn (array $row) => collect($row['authors'])->contains('user_id', $onlyAuthorId))
                ->values())
            ->sortByDesc('total')
            ->values();
    }

    /**
     * Royalti ebook SEPANJANG WAKTU per buku Press, kunci = id buku Press.
     * Buku yang tidak ada di Tartila Book tidak dimuat.
     *
     * @param  Collection<int, Book>  $books
     * @return Collection<int, array<string, mixed>>
     */
    public function forBooks(Collection $books): Collection
    {
        if ($books->isEmpty()) {
            return collect();
        }

        $readerBooks = ReaderBook::with(['book' => fn ($q) => $q->with(BookRoyaltyService::SHARE_RELATIONS)])
            ->whereIn('book_id', $books->pluck('id'))
            ->get();

        return $this->summaries($readerBooks)->keyBy('book_id');
    }

    /**
     * Pemasukan dompet dari royalti ebook (satu baris per pembelian terkonfirmasi,
     * satu baris per buku untuk bacaan), hanya bagian milik $user.
     *
     * @return Collection<int, array{type: string, label: string, title: string, detail: string|null, amount: float, date: Carbon|null}>
     */
    public function walletEntries(User $user): Collection
    {
        $entries = collect();
        $settings = ReaderSetting::current();

        foreach ($this->vouchers->royaltyBooks($user) as $row) {
            /** @var Book $book */
            $book = $row['book'];
            $readerBook = ReaderBook::where('book_id', $book->id)->first();

            if (! $readerBook) {
                continue;
            }

            $weight = collect($this->weights($book))->firstWhere('user_id', $user->id)['weight'] ?? 0;

            if ($weight <= 0) {
                continue;
            }

            $percent = (float) ($readerBook->purchase_royalty_percent ?? $settings->purchase_royalty_percent);
            $fee = (float) ($readerBook->read_fee ?? $settings->read_fee);
            $label = $row['role'] === 'editor' ? 'Royalti ebook editor' : 'Royalti ebook penulis';

            ReaderOrder::where('reader_book_id', $readerBook->id)->where('kind', 'book')->where('status', 'confirmed')
                ->get()
                ->each(function (ReaderOrder $order) use ($entries, $book, $percent, $weight, $label) {
                    $entries->push([
                        'type' => 'ebook_royalty',
                        'label' => $label,
                        'title' => $book->title,
                        'detail' => "Pembelian ebook di Tartila Book ({$order->order_number}), royalti {$percent}%",
                        'amount' => round((float) $order->amount * $percent / 100 * $weight, 2),
                        'date' => $order->confirmed_at,
                    ]);
                });

            $reads = DB::table('reader_page_reads')
                ->where('reader_book_id', $readerBook->id)->where('counted', true)
                ->selectRaw('COUNT(*) as events, MAX(read_date) as last_date')->first();

            if ($reads && $reads->events > 0) {
                $entries->push([
                    'type' => 'ebook_royalty',
                    'label' => $label,
                    'title' => $book->title,
                    'detail' => "{$reads->events} bacaan di Tartila Book × Rp ".number_format($fee, 0, ',', '.'),
                    'amount' => round($reads->events * $fee * $weight, 2),
                    'date' => Carbon::parse($reads->last_date, 'Asia/Jakarta'),
                ]);
            }
        }

        return $entries;
    }

    /**
     * @param  Collection<int, ReaderBook>  $readerBooks
     * @return Collection<int, array<string, mixed>>
     */
    private function summaries(Collection $readerBooks, ?string $from = null, ?string $to = null): Collection
    {
        $settings = ReaderSetting::current();
        $ids = $readerBooks->pluck('id');

        $purchaseQuery = ReaderOrder::where('kind', 'book')->where('status', 'confirmed')->whereIn('reader_book_id', $ids);
        $readQuery = DB::table('reader_page_reads')->where('counted', true)->whereIn('reader_book_id', $ids);

        if ($from !== null && $to !== null) {
            $purchaseQuery->whereBetween('confirmed_at', [
                Carbon::parse($from, 'Asia/Jakarta')->startOfDay()->utc(),
                Carbon::parse($to, 'Asia/Jakarta')->endOfDay()->utc(),
            ]);
            $readQuery->whereBetween('read_date', [$from, $to]);
        }

        $purchases = $purchaseQuery
            ->select('reader_book_id', DB::raw('COUNT(*) as orders'), DB::raw('SUM(amount) as revenue'))
            ->groupBy('reader_book_id')->get()->keyBy('reader_book_id');

        $reads = $readQuery
            ->select('reader_book_id', DB::raw('COUNT(*) as events'), DB::raw('COUNT(DISTINCT user_id) as readers'))
            ->groupBy('reader_book_id')->get()->keyBy('reader_book_id');

        return $readerBooks->map(function (ReaderBook $readerBook) use ($settings, $purchases, $reads) {
            $percent = $readerBook->purchase_royalty_percent ?? $settings->purchase_royalty_percent;
            $fee = $readerBook->read_fee ?? $settings->read_fee;
            $revenue = (float) ($purchases[$readerBook->id]->revenue ?? 0);
            $events = (int) ($reads[$readerBook->id]->events ?? 0);
            $purchaseRoyalty = round($revenue * $percent / 100, 2);
            $readRoyalty = round($events * $fee, 2);
            $total = round($purchaseRoyalty + $readRoyalty, 2);

            return [
                'reader_book_id' => $readerBook->id,
                'book_id' => $readerBook->book_id,
                'title' => $readerBook->book->title,
                'orders' => (int) ($purchases[$readerBook->id]->orders ?? 0),
                'revenue' => $revenue,
                'purchase_percent' => $percent,
                'purchase_royalty' => $purchaseRoyalty,
                'readers' => (int) ($reads[$readerBook->id]->readers ?? 0),
                'read_events' => $events,
                'read_fee' => $fee,
                'read_royalty' => $readRoyalty,
                'total' => $total,
                'authors' => array_map(fn (array $weight) => [
                    'user_id' => $weight['user_id'],
                    'name' => $weight['name'],
                    'weight' => round($weight['weight'], 4),
                    'amount' => round($total * $weight['weight'], 2),
                ], $this->weights($readerBook->book)),
            ];
        })->values();
    }
}
