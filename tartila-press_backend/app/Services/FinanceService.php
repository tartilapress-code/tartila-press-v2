<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Models\CustomPackageItem;
use App\Models\Event;
use App\Models\FinanceDetail;
use App\Models\FinanceSetting;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\Reader\ReaderOrder;
use App\Models\Voucher;
use App\Models\WalletWithdrawal;
use App\Services\Reader\ReaderRoyaltyService;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Keuangan admin: arus kas (pesanan dibayar, penarikan saldo, transaksi
 * manual), saldo per rekening, omzet, dan rincian estimasi laba per paket,
 * proyek Book Chapter, buku dan event.
 *
 * Status transaksi masuk: "completed" (pesanan selesai) atau "hold" (sudah
 * dibayar tetapi prosesnya belum selesai).
 */
class FinanceService
{
    public const ORDER_TYPES = [
        'package' => 'Paket',
        'custom_package' => 'Paket Custom',
        'book_chapter' => 'Book Chapter',
        'book' => 'Penjualan Buku',
        'event' => 'Pendaftaran Event',
        'ebook' => 'Tartila Book (Ebook & Langganan)',
        'other_order' => 'Pesanan Lain',
    ];

    public const PAID_STATUSES = ['confirmed', 'completed'];

    /**
     * Server menyimpan waktu dalam UTC; tanggal keuangan (omzet harian,
     * filter tanggal) mengikuti WIB supaya transaksi dini hari tidak masuk
     * ke hari sebelumnya.
     */
    public const TIMEZONE = 'Asia/Jakarta';

    private const ITEMABLE_TYPES = [
        Package::class => 'package',
        CustomPackageItem::class => 'custom_package',
        BookChapter::class => 'book_chapter',
        Book::class => 'book',
        Event::class => 'event',
    ];

    private const HKI_PATTERN = '/\bha?ki\b/i';

    public function __construct(
        private readonly BookRoyaltyService $royalties,
        private readonly BookChapterCostCalculator $chapterCost,
        private readonly ReaderRoyaltyService $readerRoyalty,
    ) {}

    /** @return array<string, string> */
    public static function typeLabels(): array
    {
        return self::ORDER_TYPES + ['withdrawal' => 'Penarikan Saldo'] + FinanceTransaction::CATEGORIES;
    }

    // =====================================================================
    // Pesanan yang sudah dibayar
    // =====================================================================

    /** @return Collection<int, Order> */
    public function paidOrders(): Collection
    {
        // Disimpan per permintaan HTTP (bukan di objek: controller bisa
        // dipakai ulang antarpermintaan, mis. di tes atau Octane).
        $attributes = request()->attributes;

        if ($attributes->has('finance.paid_orders')) {
            return $attributes->get('finance.paid_orders');
        }

        $orders = Order::with([
            'items.itemable',
            'user:id,name,email',
            'paymentMethod',
            'voucher:id,source,user_id',
            'statusHistories' => fn ($query) => $query->where('event', 'payment_confirmed'),
        ])->whereIn('status', self::PAID_STATUSES)->get();

        $attributes->set('finance.paid_orders', $orders);

        return $orders;
    }

    /**
     * Pembelian buku & langganan di Tartila Book yang sudah dikonfirmasi admin.
     * Tidak punya status "selesai": begitu dikonfirmasi, aksesnya langsung aktif.
     *
     * @return Collection<int, ReaderOrder>
     */
    public function paidReaderOrders(): Collection
    {
        $attributes = request()->attributes;

        if ($attributes->has('finance.paid_reader_orders')) {
            return $attributes->get('finance.paid_reader_orders');
        }

        $orders = ReaderOrder::with(['user:id,name', 'paymentMethod'])->where('status', 'confirmed')->get();
        $attributes->set('finance.paid_reader_orders', $orders);

        return $orders;
    }

    public function readerPaidAt(ReaderOrder $order): CarbonInterface
    {
        return Carbon::instance($order->confirmed_at ?? $order->updated_at ?? $order->created_at)->setTimezone(self::TIMEZONE);
    }

    public function orderType(Order $order): string
    {
        $type = $order->items->first()?->itemable_type;

        return self::ITEMABLE_TYPES[$type] ?? 'other_order';
    }

    /** Waktu pembayaran dikonfirmasi admin (kalau tidak tercatat: terakhir diubah). */
    public function paidAt(Order $order): CarbonInterface
    {
        $time = $order->statusHistories->where('event', 'payment_confirmed')->min('created_at')
            ?? $order->updated_at
            ?? $order->created_at;

        return Carbon::instance($time)->setTimezone(self::TIMEZONE);
    }

    // =====================================================================
    // Arus kas
    // =====================================================================

    /**
     * Semua transaksi masuk/keluar, terbaru dulu.
     *
     * @param  array{from?: string|null, to?: string|null, direction?: string|null, type?: string|null, status?: string|null, account?: string|int|null}  $filters
     * @return Collection<int, array<string, mixed>>
     */
    public function ledger(array $filters = []): Collection
    {
        $labels = self::typeLabels();
        $entries = collect();

        foreach ($this->paidOrders() as $order) {
            $type = $this->orderType($order);
            $entries->push([
                'key' => "order:{$order->id}",
                'source' => 'order',
                'source_id' => $order->id,
                'date' => $this->paidAt($order),
                'direction' => 'in',
                'type' => $type,
                'type_label' => $labels[$type],
                'description' => $order->order_number.' · '.$order->items->pluck('name')->filter()->take(3)->implode(', '),
                'party' => $order->user?->name,
                'account' => $this->account($order->paymentMethod),
                'amount' => round((float) $order->total, 2),
                'status' => $order->status === 'completed' ? 'completed' : 'hold',
            ]);
        }

        foreach ($this->paidReaderOrders() as $order) {
            $entries->push([
                'key' => "reader_order:{$order->id}",
                'source' => 'reader_order',
                'source_id' => $order->id,
                'date' => $this->readerPaidAt($order),
                'direction' => 'in',
                'type' => 'ebook',
                'type_label' => $labels['ebook'],
                'description' => $order->order_number.' · '.$order->title,
                'party' => $order->user?->name,
                'account' => $this->account($order->paymentMethod),
                'amount' => round((float) $order->amount, 2),
                'status' => 'completed',
            ]);
        }

        WalletWithdrawal::with(['user:id,name', 'paymentMethod'])->where('status', 'paid')->get()
            ->each(fn (WalletWithdrawal $withdrawal) => $entries->push([
                'key' => "withdrawal:{$withdrawal->id}",
                'source' => 'withdrawal',
                'source_id' => $withdrawal->id,
                'date' => Carbon::instance($withdrawal->processed_at ?? $withdrawal->updated_at)->setTimezone(self::TIMEZONE),
                'direction' => 'out',
                'type' => 'withdrawal',
                'type_label' => $labels['withdrawal'],
                'description' => 'Penarikan saldo ke '.$withdrawal->bank_name.' (biaya admin '.self::rupiah((float) $withdrawal->admin_fee).' tetap di kas)',
                'party' => $withdrawal->user?->name,
                'account' => $this->account($withdrawal->paymentMethod),
                'amount' => round((float) $withdrawal->net_amount, 2),
                'status' => 'completed',
            ]));

        FinanceTransaction::with('paymentMethod')->get()
            ->each(fn (FinanceTransaction $transaction) => $entries->push([
                'key' => "manual:{$transaction->id}",
                'source' => 'manual',
                'source_id' => $transaction->id,
                'date' => Carbon::parse($transaction->transaction_date->toDateString(), self::TIMEZONE),
                'direction' => $transaction->direction,
                'type' => $transaction->category,
                'type_label' => $labels[$transaction->category] ?? $transaction->category,
                'description' => $transaction->description,
                'party' => null,
                'account' => $this->account($transaction->paymentMethod),
                'amount' => round($transaction->amount, 2),
                'status' => $transaction->status,
            ]));

        return $entries
            ->filter(fn (array $entry) => $this->matches($entry, $filters))
            ->sortByDesc(fn (array $entry) => $entry['date']->getTimestamp())
            ->values();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $entries
     * @return array{in: float, out: float, net: float, hold: float, count: int}
     */
    public function totals(Collection $entries): array
    {
        $in = (float) $entries->where('direction', 'in')->sum('amount');
        $out = (float) $entries->where('direction', 'out')->sum('amount');

        return [
            'in' => round($in, 2),
            'out' => round($out, 2),
            'net' => round($in - $out, 2),
            'hold' => round((float) $entries->where('direction', 'in')->where('status', 'hold')->sum('amount'), 2),
            'count' => $entries->count(),
        ];
    }

    /**
     * Saldo tiap rekening = saldo awal + masuk − keluar; transaksi tanpa
     * rekening dikumpulkan di "Belum ditentukan".
     *
     * @return array{accounts: list<array<string, mixed>>, unassigned: array<string, float>, total: float}
     */
    public function balances(): array
    {
        $entries = $this->ledger();
        $accounts = PaymentMethod::orderBy('id')->get()->map(function (PaymentMethod $method) use ($entries) {
            $own = $entries->filter(fn (array $entry) => ($entry['account']['id'] ?? null) === $method->id);
            $in = (float) $own->where('direction', 'in')->sum('amount');
            $out = (float) $own->where('direction', 'out')->sum('amount');
            $opening = (float) $method->opening_balance;

            return [
                'id' => $method->id,
                'bank_name' => $method->bank_name,
                'account_number' => $method->account_number,
                'account_holder_name' => $method->account_holder_name,
                'is_active' => (bool) $method->is_active,
                'opening_balance' => round($opening, 2),
                'in' => round($in, 2),
                'out' => round($out, 2),
                'balance' => round($opening + $in - $out, 2),
            ];
        })->values()->all();

        $loose = $entries->filter(fn (array $entry) => $entry['account'] === null);
        $unassigned = [
            'in' => round((float) $loose->where('direction', 'in')->sum('amount'), 2),
            'out' => round((float) $loose->where('direction', 'out')->sum('amount'), 2),
            'count' => $loose->count(),
        ];
        $unassigned['balance'] = round($unassigned['in'] - $unassigned['out'], 2);

        return [
            'accounts' => $accounts,
            'unassigned' => $unassigned,
            'total' => round(array_sum(array_column($accounts, 'balance')) + $unassigned['balance'], 2),
        ];
    }

    /**
     * Omzet (pesanan dibayar) harian dalam satu bulan, bulanan dalam satu
     * tahun, dan tahunan.
     *
     * @return array{daily: list<array<string, mixed>>, monthly: list<array<string, mixed>>, yearly: list<array<string, mixed>>}
     */
    public function revenueSeries(int $year, int $month): array
    {
        $paid = $this->paidOrders()
            ->map(fn (Order $order) => ['date' => Carbon::instance($this->paidAt($order)), 'amount' => (float) $order->total])
            ->concat($this->paidReaderOrders()->map(fn (ReaderOrder $order) => ['date' => Carbon::instance($this->readerPaidAt($order)), 'amount' => (float) $order->amount]));
        $point = fn (string $label, string $period, Collection $rows) => [
            'label' => $label,
            'period' => $period,
            'amount' => round((float) $rows->sum('amount'), 2),
            'count' => $rows->count(),
        ];

        $start = Carbon::create($year, $month, 1, 0, 0, 0, self::TIMEZONE);
        $daily = [];

        for ($day = 1; $day <= $start->daysInMonth; $day++) {
            $date = $start->copy()->day($day);
            $daily[] = $point((string) $day, $date->toDateString(), $paid->filter(fn ($row) => $row['date']->isSameDay($date)));
        }

        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $monthly = [];

        foreach ($monthNames as $index => $name) {
            $monthly[] = $point($name, sprintf('%04d-%02d', $year, $index + 1), $paid->filter(
                fn ($row) => $row['date']->year === $year && $row['date']->month === $index + 1
            ));
        }

        $thisYear = (int) now(self::TIMEZONE)->year;
        $firstYear = min($year, (int) ($paid->min(fn ($row) => $row['date']->year) ?? $year), $thisYear);
        $lastYear = max($year, $thisYear);
        $yearly = [];

        for ($each = $firstYear; $each <= $lastYear; $each++) {
            $yearly[] = $point((string) $each, (string) $each, $paid->filter(fn ($row) => $row['date']->year === $each));
        }

        return ['daily' => $daily, 'monthly' => $monthly, 'yearly' => $yearly];
    }

    // =====================================================================
    // Rincian estimasi laba
    // =====================================================================

    /**
     * Paket & paket custom per pesanan: harga, diskon/voucher, fee editor,
     * HAKI, biaya cetak (persen × harga jual buku × (eks dasar + N)),
     * administrasi & cover, biaya lain, estimasi laba.
     *
     * @return list<array<string, mixed>>
     */
    public function packageRows(?string $from = null, ?string $to = null): array
    {
        $settings = FinanceSetting::current();
        $hkiCost = (float) $settings->hki_cost;
        $details = $this->details('order');

        $orders = $this->paidOrders()
            ->filter(fn (Order $order) => in_array($this->orderType($order), ['package', 'custom_package'], true))
            ->filter(fn (Order $order) => $this->inRange($this->paidAt($order), $from, $to));

        // Sekali untuk semua pesanan (bukan per pesanan).
        EloquentCollection::make($orders->all())->loadMissing('manuscript.book:id,manuscript_id,title,price');

        return $orders->map(function (Order $order) use ($settings, $hkiCost, $details) {
            $detail = $details->get($order->id);
            $isPackage = $this->orderType($order) === 'package';
            $itemables = $order->items->map(fn (OrderItem $item) => $item->itemable)->filter();

            $hkiAuto = $this->orderMentionsHki($order);
            $copiesAuto = $isPackage
                ? (int) ($itemables->first()?->free_copies ?? 0)
                : (int) $order->items->sum(fn (OrderItem $item) => (int) ($item->itemable?->free_copies ?? 0) * max(1, (int) $item->quantity));

            $book = $order->manuscript?->book;
            [$bookPrice, $bookPriceSource] = $this->bookPrice($detail, (float) ($book?->price ?? 0), $settings);

            $includesHki = $detail?->includes_hki ?? $hkiAuto;
            $extraCopies = $detail?->extra_copies ?? $copiesAuto;
            $manuscriptFee = $order->manuscript?->editor_fee;

            $row = [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'date' => $this->paidAt($order)->toDateString(),
                'buyer' => $order->user?->name,
                'name' => $order->items->pluck('name')->filter()->implode(', '),
                'type' => $this->orderType($order),
                'status' => $order->status === 'completed' ? 'completed' : 'hold',
                'received' => round((float) $order->total, 2),
                'price' => round((float) $order->subtotal + (float) $order->editor_fee, 2),
                'discount' => round((float) $order->discount_total + (float) $order->voucher_discount + (float) $order->voucher_fee, 2),
                'editor_fee' => round($manuscriptFee !== null ? (float) $manuscriptFee : (float) $order->editor_fee, 2),
                'editor_fee_source' => $manuscriptFee !== null ? 'manuscript' : 'order',
                'includes_hki' => $includesHki,
                'hki_auto' => $hkiAuto,
                'hki' => $includesHki ? $hkiCost : 0.0,
                'book_title' => $book?->title,
                'book_price' => $bookPrice,
                'book_price_source' => $bookPriceSource,
                'copies' => ['base' => $settings->base_print_copies, 'extra' => $extraCopies, 'extra_auto' => $copiesAuto],
                'print_cost' => $this->printCost($bookPrice, $settings->base_print_copies + $extraCopies, $settings),
                'admin_cover' => round($detail?->admin_cover_cost ?? $settings->admin_cover_cost, 2),
                'other_costs' => round($detail?->other_costs ?? 0, 2),
                'note' => $detail?->note,
                'overrides' => $this->overrides($detail),
            ];

            return $this->withProfit($row, ['discount', 'editor_fee', 'hki', 'print_cost', 'admin_cover', 'other_costs']);
        })->sortByDesc('date')->values()->all();
    }

    /**
     * Proyek Book Chapter (per buku): pendapatan slot bab terjual dikurangi
     * fee editor, HAKI, ISBN & item (dari pengaturan proyek), cetak,
     * administrasi & cover, biaya lain.
     *
     * @return list<array<string, mixed>>
     */
    public function bookChapterRows(): array
    {
        $settings = FinanceSetting::current();
        $chapterSettings = BookChapterSetting::current();
        $details = $this->details('book');
        $paidIds = $this->paidOrders()->pluck('id')->all();

        return Book::with(['chapters.order.statusHistories', 'packageItems', 'compilation', 'ownerEditor:id,name'])
            ->where('is_chapter_offering', true)
            ->get()
            ->map(function (Book $project) use ($settings, $chapterSettings, $details, $paidIds) {
                $sold = $project->chapters->filter(fn (BookChapter $chapter) => $chapter->order && in_array($chapter->order->id, $paidIds, true));

                if ($sold->isEmpty()) {
                    return null;
                }

                $detail = $details->get($project->id);
                $calc = $this->chapterCost->summarize($project, $chapterSettings);
                $orders = $sold->map(fn (BookChapter $chapter) => $chapter->order);

                $ownerFees = $project->owner_editor_id
                    ? (float) $sold->sum(fn (BookChapter $chapter) => (float) ($calc['chapter_fees'][$chapter->id] ?? 0))
                    : 0.0;
                $compilationFee = (float) ($project->compilation?->editor_fee ?? 0);

                $includesHki = $detail?->includes_hki ?? (bool) $project->includes_hki;
                $copiesAuto = (int) $project->packageItems->sum('free_copies');
                $extraCopies = $detail?->extra_copies ?? $copiesAuto;
                [$bookPrice, $bookPriceSource] = $this->bookPrice($detail, 0.0, $settings);
                $autoOther = (float) $calc['deductions']['isbn_print'] + (float) $calc['deductions']['isbn_electronic'] + (float) $calc['deductions']['items'];

                $row = [
                    'id' => $project->id,
                    'title' => $project->title,
                    'date' => $orders->map(fn (Order $order) => $this->paidAt($order))->max()?->toDateString(),
                    'chapter_count' => $project->chapters->count(),
                    'sold_count' => $sold->count(),
                    'owner_editor' => $project->ownerEditor?->name,
                    'status' => $project->compilation?->status === 'completed' ? 'completed' : 'hold',
                    'received' => round((float) $orders->sum('total'), 2),
                    'price' => round((float) $orders->sum(fn (Order $order) => (float) $order->subtotal + (float) $order->editor_fee), 2),
                    'discount' => round((float) $orders->sum(fn (Order $order) => (float) $order->discount_total + (float) $order->voucher_discount + (float) $order->voucher_fee), 2),
                    'editor_fee' => round($ownerFees + $compilationFee, 2),
                    'includes_hki' => $includesHki,
                    'hki_auto' => (bool) $project->includes_hki,
                    'hki' => $includesHki ? (float) $settings->hki_cost : 0.0,
                    'book_price' => $bookPrice,
                    'book_price_source' => $bookPriceSource,
                    'copies' => ['base' => $settings->base_print_copies, 'extra' => $extraCopies, 'extra_auto' => $copiesAuto],
                    'print_cost' => $this->printCost($bookPrice, $settings->base_print_copies + $extraCopies, $settings),
                    'admin_cover' => round($detail?->admin_cover_cost ?? $settings->admin_cover_cost, 2),
                    'auto_other_costs' => round($autoOther, 2),
                    'other_costs' => round($autoOther + ($detail?->other_costs ?? 0), 2),
                    'manual_other_costs' => round($detail?->other_costs ?? 0, 2),
                    'note' => $detail?->note,
                    'overrides' => $this->overrides($detail),
                ];

                return $this->withProfit($row, ['discount', 'editor_fee', 'hki', 'print_cost', 'admin_cover', 'other_costs']);
            })
            ->filter()
            ->sortByDesc('date')
            ->values()
            ->all();
    }

    /**
     * Penjualan buku per judul: harga, diskon/voucher, biaya cetak (persen ×
     * harga jual per eksemplar), royalti, estimasi laba.
     *
     * @return list<array<string, mixed>>
     */
    public function bookRows(?string $from = null, ?string $to = null): array
    {
        $settings = FinanceSetting::current();
        $details = $this->details('book');
        $lines = collect();

        foreach ($this->paidOrders() as $order) {
            if (! $this->inRange($this->paidAt($order), $from, $to)) {
                continue;
            }

            foreach ($order->items as $item) {
                if ($item->itemable_type === Book::class) {
                    $lines->push(['order' => $order, 'item' => $item]);
                }
            }
        }

        $books = Book::with(BookRoyaltyService::SHARE_RELATIONS)
            ->whereIn('id', $lines->pluck('item.itemable_id')->unique())
            ->get()
            ->keyBy('id');

        return $lines->groupBy(fn ($line) => $line['item']->itemable_id)->map(function (Collection $group, $bookId) use ($books, $settings, $details) {
            $book = $books->get($bookId);
            $rate = $book ? (float) collect($this->royalties->shares($book))->sum('rate') : 0.0;
            $detail = $details->get((int) $bookId);

            $gross = 0.0;
            $discount = 0.0;
            $royalty = 0.0;
            $quantity = 0;

            foreach ($group as ['order' => $order, 'item' => $item]) {
                $lineGross = (float) $item->unit_price * max(1, (int) $item->quantity);
                $voucherDiscount = (float) $item->voucher_discount;
                $voucherFee = (float) $order->voucher_discount > 0
                    ? (float) $order->voucher_fee * $voucherDiscount / (float) $order->voucher_discount
                    : 0.0;
                // Voucher dari royalti penulis memotong royaltinya, bukan kas penerbit.
                $royaltyVoucher = $order->voucher?->source === Voucher::SOURCE_ROYALTY;

                $quantity += max(1, (int) $item->quantity);
                $gross += $lineGross;
                $discount += (float) $item->discount + $voucherDiscount + $voucherFee;
                $royalty += max(0, $lineGross * $rate / 100 - ($royaltyVoucher ? $voucherDiscount : 0));
            }

            $paid = $group->pluck('order');
            $row = [
                'id' => (int) $bookId,
                'title' => $book?->title ?? $group->first()['item']->name,
                'quantity' => $quantity,
                'unit_price' => round((float) ($book?->price ?? 0), 2),
                'status' => $paid->every(fn (Order $order) => $order->status === 'completed') ? 'completed' : 'hold',
                'hold_count' => $paid->where('status', 'confirmed')->count(),
                'price' => round($gross, 2),
                'discount' => round($discount, 2),
                'print_cost' => round($gross * $settings->print_cost_percent / 100, 2),
                'royalty_rate' => round($rate, 2),
                'royalty' => round($royalty, 2),
                'other_costs' => round($detail?->other_costs ?? 0, 2),
                'note' => $detail?->note,
                'overrides' => $this->overrides($detail),
            ];

            return $this->withProfit($row, ['discount', 'print_cost', 'royalty', 'other_costs']);
        })->sortByDesc('price')->values()->all();
    }

    /**
     * Tartila Book per judul (pembelian + bacaan) dan satu baris langganan.
     * Laba = pendapatan − royalti pembelian − royalti bacaan; langganan tidak
     * punya biaya langsung karena royalti bacaannya sudah dihitung di judulnya.
     *
     * @return list<array<string, mixed>>
     */
    public function ebookRows(?string $from = null, ?string $to = null): array
    {
        $rows = $this->readerRoyalty
            ->report($from ?: '2000-01-01', $to ?: '2100-12-31')
            ->filter(fn (array $row) => $row['orders'] > 0 || $row['read_events'] > 0)
            ->map(function (array $row) {
                $costs = $row['purchase_royalty'] + $row['read_royalty'];

                return [
                    'id' => $row['reader_book_id'],
                    'kind' => 'book',
                    'title' => $row['title'],
                    'status' => 'completed',
                    'orders' => $row['orders'],
                    'readers' => $row['readers'],
                    'read_events' => $row['read_events'],
                    'price' => round($row['revenue'], 2),
                    'purchase_percent' => (float) $row['purchase_percent'],
                    'purchase_royalty' => round($row['purchase_royalty'], 2),
                    'read_fee' => (float) $row['read_fee'],
                    'read_royalty' => round($row['read_royalty'], 2),
                    'total_costs' => round($costs, 2),
                    'profit' => round($row['revenue'] - $costs, 2),
                ];
            })
            ->values()
            ->all();

        $plans = $this->paidReaderOrders()
            ->filter(fn (ReaderOrder $order) => $order->kind === 'plan' && $this->inRange($this->readerPaidAt($order), $from, $to));

        if ($plans->isNotEmpty()) {
            $revenue = round((float) $plans->sum('amount'), 2);
            $rows[] = [
                'id' => 0,
                'kind' => 'subscription',
                'title' => 'Langganan Tartila Book',
                'status' => 'completed',
                'orders' => $plans->count(),
                'readers' => 0,
                'read_events' => 0,
                'price' => $revenue,
                'purchase_percent' => 0.0,
                'purchase_royalty' => 0.0,
                'read_fee' => 0.0,
                'read_royalty' => 0.0,
                'total_costs' => 0.0,
                'profit' => $revenue,
            ];
        }

        return $rows;
    }

    /**
     * Biaya pendaftaran event: harga, jumlah peserta, pendapatan, fee
     * pemateri & biaya lain (diisi admin), estimasi laba.
     *
     * @return list<array<string, mixed>>
     */
    public function eventRows(): array
    {
        $details = $this->details('event');
        $paidByEvent = $this->paidOrders()
            ->filter(fn (Order $order) => $this->orderType($order) === 'event')
            ->groupBy(fn (Order $order) => $order->items->first()->itemable_id);

        return Event::withCount(['registrations as participants_count' => fn ($query) => $query->where('status', 'confirmed')])
            ->orderByDesc('starts_at')
            ->get()
            ->map(function (Event $event) use ($details, $paidByEvent) {
                $orders = $paidByEvent->get($event->id, collect());
                $detail = $details->get($event->id);

                $row = [
                    'id' => $event->id,
                    'title' => $event->title,
                    'date' => $event->starts_at?->toDateString(),
                    'status' => $event->ends_at?->isPast() ?? $event->starts_at?->isPast() ? 'completed' : 'hold',
                    'fee' => round((float) $event->fee, 2),
                    'participants' => (int) $event->participants_count,
                    'paid_count' => $orders->count(),
                    'price' => round((float) $orders->sum('subtotal'), 2),
                    'discount' => round((float) $orders->sum(fn (Order $order) => (float) $order->discount_total + (float) $order->voucher_discount + (float) $order->voucher_fee), 2),
                    'speaker_fee' => round($detail?->speaker_fee ?? 0, 2),
                    'other_costs' => round($detail?->other_costs ?? 0, 2),
                    'note' => $detail?->note,
                    'overrides' => $this->overrides($detail),
                ];

                return $this->withProfit($row, ['discount', 'speaker_fee', 'other_costs']);
            })
            ->values()
            ->all();
    }

    // =====================================================================
    // Pembantu
    // =====================================================================

    /** @return array{id: int, name: string}|null */
    private function account(?PaymentMethod $method): ?array
    {
        return $method ? ['id' => $method->id, 'name' => $method->bank_name.' · '.$method->account_number] : null;
    }

    private function matches(array $entry, array $filters): bool
    {
        $date = Carbon::instance($entry['date']);

        if (! empty($filters['from']) && $date->lt(Carbon::parse($filters['from'], self::TIMEZONE)->startOfDay())) {
            return false;
        }

        if (! empty($filters['to']) && $date->gt(Carbon::parse($filters['to'], self::TIMEZONE)->endOfDay())) {
            return false;
        }

        foreach (['direction', 'type', 'status'] as $key) {
            if (! empty($filters[$key]) && $entry[$key] !== $filters[$key]) {
                return false;
            }
        }

        if (isset($filters['account']) && $filters['account'] !== '') {
            $accountId = $entry['account']['id'] ?? null;

            return $filters['account'] === 'none' ? $accountId === null : (int) $filters['account'] === $accountId;
        }

        return true;
    }

    private function inRange(CarbonInterface $date, ?string $from, ?string $to): bool
    {
        return (! $from || $date->gte(Carbon::parse($from, self::TIMEZONE)->startOfDay()))
            && (! $to || $date->lte(Carbon::parse($to, self::TIMEZONE)->endOfDay()));
    }

    /**
     * Isian admin apa adanya (null = otomatis) untuk formulir ubah rincian.
     *
     * @return array<string, mixed>
     */
    private function overrides(?FinanceDetail $detail): array
    {
        $fields = ['book_price', 'extra_copies', 'includes_hki', 'admin_cover_cost', 'speaker_fee', 'other_costs', 'note'];

        return array_combine($fields, array_map(fn ($field) => $detail?->{$field}, $fields));
    }

    /** @return Collection<int, FinanceDetail> */
    private function details(string $subject): Collection
    {
        return FinanceDetail::where('subject_type', $subject)->get()->keyBy('subject_id');
    }

    /** Paket/item pesanan ini memuat layanan HKI (dari nama fasilitas/layanan/item). */
    public function orderMentionsHki(Order $order): bool
    {
        return $order->items->contains(fn (OrderItem $item) => $this->mentionsHki($item->itemable));
    }

    /**
     * Pesanan paket/paket custom termasuk HKI: isian admin di rincian
     * keuangan bila ada, kalau tidak dari fasilitas/layanan paketnya.
     */
    public function orderIncludesHki(Order $order, ?Collection $overrides = null): bool
    {
        $override = $overrides !== null
            ? $overrides->get('order:'.$order->id)
            : FinanceDetail::where('subject_type', 'order')->where('subject_id', $order->id)->value('includes_hki');

        return $override !== null ? (bool) $override : $this->orderMentionsHki($order);
    }

    /** Proyek Book Chapter / buku termasuk HKI (isian admin atau centang HKI buku). */
    public function bookIncludesHki(Book $book, ?Collection $overrides = null): bool
    {
        $override = $overrides !== null
            ? $overrides->get('book:'.$book->id)
            : FinanceDetail::where('subject_type', 'book')->where('subject_id', $book->id)->value('includes_hki');

        return $override !== null ? (bool) $override : (bool) $book->includes_hki;
    }

    /**
     * Semua isian admin "termasuk HKI" sekaligus (satu query), untuk
     * memeriksa banyak karya: kunci "order:{id}" / "book:{id}".
     *
     * @return Collection<string, bool>
     */
    public function hkiOverrides(): Collection
    {
        return FinanceDetail::whereNotNull('includes_hki')
            ->get(['subject_type', 'subject_id', 'includes_hki'])
            ->mapWithKeys(fn (FinanceDetail $detail) => [$detail->subject_type.':'.$detail->subject_id => (bool) $detail->includes_hki]);
    }

    private function mentionsHki(mixed $itemable): bool
    {
        if ($itemable instanceof Package) {
            return collect([...(array) $itemable->facilities, ...(array) $itemable->services])
                ->contains(fn ($text) => is_string($text) && preg_match(self::HKI_PATTERN, $text));
        }

        return $itemable instanceof CustomPackageItem && preg_match(self::HKI_PATTERN, (string) $itemable->name) === 1;
    }

    /** @return array{0: float, 1: string} harga jual buku + sumbernya */
    private function bookPrice(?FinanceDetail $detail, float $published, FinanceSetting $settings): array
    {
        return match (true) {
            $detail?->book_price !== null => [round($detail->book_price, 2), 'admin'],
            $published > 0 => [round($published, 2), 'book'],
            default => [round($settings->default_book_price, 2), 'default'],
        };
    }

    private function printCost(float $bookPrice, int $copies, FinanceSetting $settings): float
    {
        return round($bookPrice * $settings->print_cost_percent / 100 * max(0, $copies), 2);
    }

    /** @param  list<string>  $costs */
    private function withProfit(array $row, array $costs): array
    {
        $row['total_costs'] = round(array_sum(array_map(fn ($key) => (float) $row[$key], $costs)), 2);
        $row['profit'] = round((float) $row['price'] - $row['total_costs'], 2);

        return $row;
    }

    public static function rupiah(float $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }
}
