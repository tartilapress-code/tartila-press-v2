<?php

namespace App\Services\Reader;

use App\Models\Book;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderOrder;
use App\Models\Reader\ReaderSetting;
use App\Models\Scopes\ExcludePartnerBooks;
use App\Models\User;
use App\Services\BookRoyaltyService;
use App\Services\VoucherService;
use App\Support\PartnerSplit;
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
 *
 * Skala: jumlah bacaan TIDAK dihitung dari reader_page_reads (puluhan juta baris). Rentang tanggal
 * memakai reader_daily_reads (satu baris per buku per hari); sepanjang waktu memakai
 * reader_books.read_events.
 */
class ReaderRoyaltyService
{
    public function __construct(
        private readonly BookRoyaltyService $royalty,
        private readonly VoucherService $vouchers,
    ) {}

    /**
     * Bobot pembagian royalti ebook per penerima (jumlah semua bobot = 1).
     * Buku mitra: bobot tetap penulis/mitra menurut sistem ('purchase' atau 'read', lihat PartnerSplit).
     *
     * @return list<array{user_id: int, name: string, weight: float}>
     */
    public function weights(Book $book, string $system = 'purchase'): array
    {
        if ($book->isPartnerBook()) {
            return $this->partnerWeights($book, $system);
        }

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
     * Laporan per buku pada rentang tanggal. Tanpa $withAuthors baris tidak memuat pembagian penulis
     * (jauh lebih murah untuk ribuan buku); panggil attachAuthors() untuk baris yang ditampilkan saja.
     *
     * @param  string  $from  tanggal WIB (Y-m-d)
     * @param  string  $to  tanggal WIB (Y-m-d)
     * @param  list<int>|null  $onlyBookIds  id buku Tartila Press (misal buku milik satu penulis)
     * @return Collection<int, array<string, mixed>> per buku, terbesar dulu
     */
    public function report(string $from, string $to, ?string $search = null, ?array $onlyBookIds = null, bool $withAuthors = true): Collection
    {
        $query = ReaderBook::query()
            ->with($withAuthors ? ['book' => fn ($q) => $q->with(BookRoyaltyService::SHARE_RELATIONS)] : ['book:id,title,partner_id'])
            ->whereHas('book')
            ->when($onlyBookIds !== null, fn ($q) => $q->whereIn('book_id', $onlyBookIds))
            ->when($search, function ($query) use ($search) {
                $term = '%'.mb_strtolower($search).'%';
                $query->whereHas('book', fn ($book) => $book->whereRaw('LOWER(title) LIKE ?', [$term]));
            });

        return $this->summaries($query->get(), $from, $to, $withAuthors)
            ->sortByDesc('total')
            ->values();
    }

    /** Laporan untuk satu penerima: hanya buku di mana dia punya bagian (penulis atau editor). */
    public function reportForUser(User $user, string $from, string $to): Collection
    {
        $ids = $this->vouchers->royaltyBooks($user)->pluck('book.id')->all();

        return $ids === [] ? collect() : $this->report($from, $to, null, $ids);
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
     * Tambahkan pembagian penulis ke baris laporan (hanya untuk baris yang ditampilkan).
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    public function attachAuthors(Collection $rows): Collection
    {
        if ($rows->isEmpty()) {
            return $rows;
        }

        $books = Book::withoutGlobalScope(ExcludePartnerBooks::class)->with(BookRoyaltyService::SHARE_RELATIONS)
            ->whereIn('id', $rows->pluck('book_id'))
            ->get()
            ->keyBy('id');

        return $rows->map(function (array $row) use ($books) {
            $book = $books->get($row['book_id']);
            $row['authors'] = $book ? $this->authorRows($book, (float) $row['total'], $row) : [];

            return $row;
        });
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

            $isPartner = $book->isPartnerBook();
            $weight = collect($this->weights($book, 'purchase'))->firstWhere('user_id', $user->id)['weight'] ?? 0;
            $readWeight = collect($this->weights($book, 'read'))->firstWhere('user_id', $user->id)['weight'] ?? 0;

            if ($weight <= 0 && $readWeight <= 0) {
                continue;
            }

            // Buku mitra: kolam penulis + mitra tetap (80% pembelian, 90% bacaan); sisanya bagian Tartila.
            $percent = $isPartner
                ? PartnerSplit::pool('purchase')
                : (float) ($readerBook->purchase_royalty_percent ?? $settings->purchase_royalty_percent);
            $fee = (float) ($readerBook->read_fee ?? $settings->read_fee);
            $readFee = $isPartner ? $fee * PartnerSplit::pool('read') / 100 : $fee;
            $label = match (true) {
                $row['role'] === 'partner' => 'Bagi hasil mitra ebook',
                $row['role'] === 'editor' => 'Royalti ebook editor',
                default => 'Royalti ebook penulis',
            };

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

            $events = (int) $readerBook->read_events;

            if ($events > 0) {
                $last = DB::table('reader_daily_reads')->where('reader_book_id', $readerBook->id)->max('read_date');

                $entries->push([
                    'type' => 'ebook_royalty',
                    'label' => $label,
                    'title' => $book->title,
                    'detail' => "{$events} bacaan di Tartila Book × Rp ".number_format($readFee, 0, ',', '.'),
                    'amount' => round($events * $readFee * $readWeight, 2),
                    'date' => $last ? Carbon::parse($last, 'Asia/Jakarta') : $readerBook->updated_at,
                ]);
            }
        }

        return $entries;
    }

    /**
     * @param  Collection<int, ReaderBook>  $readerBooks
     * @return Collection<int, array<string, mixed>>
     */
    private function summaries(Collection $readerBooks, ?string $from = null, ?string $to = null, bool $withAuthors = true): Collection
    {
        $settings = ReaderSetting::current();
        $ids = $readerBooks->pluck('id');
        $ranged = $from !== null && $to !== null;

        $purchaseQuery = ReaderOrder::where('kind', 'book')->where('status', 'confirmed')
            ->when($readerBooks->count() < 500, fn ($q) => $q->whereIn('reader_book_id', $ids));

        if ($ranged) {
            $purchaseQuery->whereBetween('confirmed_at', [
                Carbon::parse($from, 'Asia/Jakarta')->startOfDay()->utc(),
                Carbon::parse($to, 'Asia/Jakarta')->endOfDay()->utc(),
            ]);
        }

        $purchases = $purchaseQuery
            ->select('reader_book_id', DB::raw('COUNT(*) as orders'), DB::raw('SUM(amount) as revenue'))
            ->groupBy('reader_book_id')->get()->keyBy('reader_book_id');

        $events = $ranged
            ? DB::table('reader_daily_reads')
                ->whereBetween('read_date', [$from, $to])
                ->when($readerBooks->count() < 500, fn ($q) => $q->whereIn('reader_book_id', $ids))
                ->select('reader_book_id', DB::raw('SUM(events) as events'))
                ->groupBy('reader_book_id')->get()->pluck('events', 'reader_book_id')
            : $readerBooks->pluck('read_events', 'id');

        return $readerBooks->map(function (ReaderBook $readerBook) use ($settings, $purchases, $events, $withAuthors) {
            $isPartner = $readerBook->book->isPartnerBook();
            $percent = $isPartner ? PartnerSplit::pool('purchase') : ($readerBook->purchase_royalty_percent ?? $settings->purchase_royalty_percent);
            $fee = $readerBook->read_fee ?? $settings->read_fee;
            $revenue = (float) ($purchases[$readerBook->id]->revenue ?? 0);
            $count = (int) ($events[$readerBook->id] ?? 0);
            $purchaseRoyalty = round($revenue * $percent / 100, 2);
            // Buku mitra: 90% dari nilai bacaan dibagikan (penulis 75 + mitra 15), 10% bagian Tartila.
            $readRoyalty = round($count * $fee * ($isPartner ? PartnerSplit::pool('read') / 100 : 1), 2);
            $total = round($purchaseRoyalty + $readRoyalty, 2);

            $row = [
                'reader_book_id' => $readerBook->id,
                'book_id' => $readerBook->book_id,
                'title' => $readerBook->book->title,
                'orders' => (int) ($purchases[$readerBook->id]->orders ?? 0),
                'revenue' => $revenue,
                'purchase_percent' => $percent,
                'purchase_royalty' => $purchaseRoyalty,
                'read_events' => $count,
                'read_fee' => $fee,
                'read_royalty' => $readRoyalty,
                'total' => $total,
            ];

            if ($withAuthors) {
                $row['authors'] = $this->authorRows($readerBook->book, $total, $row);
            }

            return $row;
        })->values();
    }

    /**
     * Bobot buku mitra: penulis (akun, dibagi rata) + mitra, menurut sistem.
     *
     * @return list<array{user_id: int, name: string, weight: float}>
     */
    private function partnerWeights(Book $book, string $system): array
    {
        $book->loadMissing(['partner.user', 'partnerAuthors']);

        if (! $book->partner) {
            return [];
        }

        $names = $book->partnerAuthors->pluck('name', 'id')->all() + [$book->partner->user_id => $book->partner->company_name];

        return array_map(fn (array $row) => [
            'user_id' => $row['user_id'],
            'name' => $row['role'] === 'partner' ? 'Mitra: '.($names[$row['user_id']] ?? '-') : ($names[$row['user_id']] ?? '-'),
            'weight' => $row['weight'],
        ], PartnerSplit::weights($system, $book->partnerAuthors->pluck('id')->all(), $book->partner->user_id));
    }

    /**
     * @param  array<string, mixed>  $summary  baris laporan (purchase_royalty / read_royalty) untuk buku mitra
     * @return list<array{user_id: int, name: string, weight: float, amount: float}>
     */
    private function authorRows(Book $book, float $total, array $summary = []): array
    {
        if ($book->isPartnerBook() && isset($summary['purchase_royalty'], $summary['read_royalty'])) {
            $purchase = collect($this->weights($book, 'purchase'))->keyBy('user_id');
            $read = collect($this->weights($book, 'read'))->keyBy('user_id');

            return collect($purchase->keys()->merge($read->keys())->unique())->map(function ($userId) use ($purchase, $read, $summary, $total) {
                $amount = (float) $summary['purchase_royalty'] * ($purchase[$userId]['weight'] ?? 0)
                    + (float) $summary['read_royalty'] * ($read[$userId]['weight'] ?? 0);

                return [
                    'user_id' => $userId,
                    'name' => ($purchase[$userId] ?? $read[$userId])['name'],
                    'weight' => $total > 0 ? round($amount / $total, 4) : 0.0,
                    'amount' => round($amount, 2),
                ];
            })->values()->all();
        }

        return array_map(fn (array $weight) => [
            'user_id' => $weight['user_id'],
            'name' => $weight['name'],
            'weight' => round($weight['weight'], 4),
            'amount' => round($total * $weight['weight'], 2),
        ], $this->weights($book));
    }
}
