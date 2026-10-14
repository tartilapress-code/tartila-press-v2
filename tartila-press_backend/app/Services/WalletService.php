<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookChapterSetting;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Models\Voucher;
use App\Models\WalletWithdrawal;
use App\Services\Reader\ReaderRoyaltyService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Dompet penulis/editor. Tidak ada tabel mutasi: pemasukan dihitung dari data
 * yang sudah ada (fee editor, royalti buku, royalti ebook Tartila Book, fee
 * penjualan dari voucher) dan
 * saldo = semua pemasukan - penarikan yang masih diproses atau sudah dibayar.
 */
class WalletService
{
    public const TYPE_LABELS = [
        'editor_fee' => 'Fee editor',
        'coauthor_fee' => 'Fee co-author',
        'royalty' => 'Royalti penulis',
        'ebook_royalty' => 'Royalti ebook',
        'sales_fee' => 'Fee penjualan',
    ];

    public function __construct(
        private readonly VoucherService $vouchers,
        private readonly BookRoyaltyService $royalty,
        private readonly BookChapterCostCalculator $costCalculator,
        private readonly ReaderRoyaltyService $readerRoyalty,
    ) {}

    /**
     * Semua pemasukan user, terbaru dulu.
     *
     * @return Collection<int, array{type: string, label: string, title: string, detail: string|null, amount: float, date: Carbon|null}>
     */
    public function entries(User $user): Collection
    {
        return collect()
            ->merge($this->editorFees($user))
            ->merge($this->coauthorFees($user))
            ->merge($this->royalties($user))
            ->merge($this->readerRoyalty->walletEntries($user))
            ->merge($this->salesFees($user))
            ->filter(fn (array $entry) => $entry['amount'] > 0)
            ->sortByDesc(fn (array $entry) => $entry['date']?->getTimestamp() ?? 0)
            ->values();
    }

    /**
     * @return array{earned: float, withdrawn: float, pending: float, balance: float, by_type: array<string, float>}
     */
    public function summary(User $user, ?Collection $entries = null): array
    {
        $entries ??= $this->entries($user);

        $byType = [];

        foreach (array_keys(self::TYPE_LABELS) as $type) {
            $byType[$type] = round($entries->where('type', $type)->sum('amount'), 2);
        }

        $earned = round(array_sum($byType), 2);
        $paid = (float) WalletWithdrawal::where('user_id', $user->id)->where('status', 'paid')->sum('amount');
        $pending = (float) WalletWithdrawal::where('user_id', $user->id)->where('status', 'pending')->sum('amount');

        return [
            'earned' => $earned,
            'withdrawn' => round($paid, 2),
            'pending' => round($pending, 2),
            'balance' => round($earned - $paid - $pending, 2),
            'by_type' => $byType,
        ];
    }

    /**
     * Semua pemasukan royalti user (buku fisik/luar sistem + ebook Tartila Book): dipakai Kelola Penulis.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function royaltyEntries(User $user): Collection
    {
        return $this->royalties($user)->merge($this->readerRoyalty->walletEntries($user));
    }

    /**
     * Semua fee layanan user (editor + co-author), tanpa royalti: dipakai Kelola Editor.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function serviceFees(User $user): Collection
    {
        return $this->editorFees($user)->merge($this->coauthorFees($user));
    }

    /** Fee menyusun naskah sebagai co-author (setelah naskah selesai). */
    private function coauthorFees(User $user): Collection
    {
        return $user->coauthoredManuscripts()->where('status', 'completed')->with('user:id,name')->get()
            ->map(fn (Manuscript $manuscript) => [
                'type' => 'coauthor_fee',
                'label' => self::TYPE_LABELS['coauthor_fee'],
                'title' => $manuscript->title,
                'detail' => 'Menyusun naskah sebagai co-author'.($manuscript->user ? ' — penulis '.$manuscript->user->name : ''),
                'amount' => (float) ($manuscript->coauthor_fee ?? 0),
                'date' => $manuscript->updated_at,
            ]);
    }

    /** Fee edit naskah yang sudah selesai + fee slot bab terjual di proyek Book Chapter miliknya. */
    private function editorFees(User $user): Collection
    {
        $entries = collect();

        $user->assignedManuscripts()->where('status', 'completed')->with('user:id,name')->get()
            ->each(function (Manuscript $manuscript) use ($entries) {
                $entries->push([
                    'type' => 'editor_fee',
                    'label' => self::TYPE_LABELS['editor_fee'],
                    'title' => $manuscript->title,
                    'detail' => 'Edit naskah'.($manuscript->user ? ' — penulis '.$manuscript->user->name : ''),
                    'amount' => (float) ($manuscript->editor_fee ?? 0),
                    'date' => $manuscript->updated_at,
                ]);
            });

        $settings = BookChapterSetting::current();

        Book::with(['chapters.order', 'packageItems'])
            ->where('is_chapter_offering', true)
            ->where('owner_editor_id', $user->id)
            ->get()
            ->each(function (Book $project) use ($entries, $settings) {
                $fees = $this->costCalculator->summarize($project, $settings)['chapter_fees'];

                foreach ($project->chapters as $chapter) {
                    if (! in_array($chapter->order?->status, ['confirmed', 'completed'], true)) {
                        continue;
                    }

                    $entries->push([
                        'type' => 'editor_fee',
                        'label' => self::TYPE_LABELS['editor_fee'],
                        'title' => $project->title,
                        'detail' => 'Slot bab '.$chapter->chapter_number.' terjual (proyek Book Chapter)',
                        'amount' => (float) ($fees[$chapter->id] ?? 0),
                        'date' => $chapter->order->updated_at,
                    ]);
                }
            });

        return $entries;
    }

    /** Royalti per penjualan selesai (sudah dikurangi voucher dari royaltinya) + penjualan luar sistem. */
    private function royalties(User $user): Collection
    {
        $entries = collect();

        foreach ($this->vouchers->royaltyBooks($user) as $row) {
            /** @var Book $book */
            $book = $row['book']->loadMissing(['orderItems.order.voucher', 'externalSales']);
            $rate = $row['rate'];
            $roleLabel = $row['role'] === 'editor' ? 'Royalti editor' : 'Royalti penulis';

            foreach ($book->orderItems as $item) {
                if ($item->order?->status !== 'completed') {
                    continue;
                }

                $gross = (float) $item->unit_price * $item->quantity * $rate / 100;
                $voucher = $item->order->voucher;
                $deduction = $voucher && $voucher->source === Voucher::SOURCE_ROYALTY && $voucher->user_id === $user->id
                    ? (float) $item->voucher_discount
                    : 0.0;

                $entries->push([
                    'type' => 'royalty',
                    'label' => $roleLabel,
                    'title' => $book->title,
                    'detail' => $this->saleDetail($item, $rate, $deduction),
                    'amount' => round(max(0, $gross - $deduction), 2),
                    'date' => $item->order->updated_at,
                ]);
            }

            foreach ($book->externalSales as $sale) {
                // Penjualan ebook memakai royalti ebook (MOU).
                $saleRate = $sale->format === 'ebook' ? ($row['ebook_rate'] ?? $rate) : $rate;
                $kind = $sale->format === 'ebook' ? 'ebook ' : '';

                $entries->push([
                    'type' => 'royalty',
                    'label' => $roleLabel,
                    'title' => $book->title,
                    'detail' => "Penjualan {$kind}luar sistem ({$sale->marketplace_name}) × {$sale->quantity_sold}, royalti {$saleRate}%",
                    'amount' => round((float) $sale->original_price * $saleRate / 100 * $sale->quantity_sold, 2),
                    'date' => $sale->created_at,
                ]);
            }
        }

        return $entries;
    }

    private function saleDetail(OrderItem $item, float $rate, float $deduction): string
    {
        $text = "Penjualan {$item->order->order_number} × {$item->quantity}, royalti {$rate}%";

        return $deduction > 0 ? $text.' (dipotong voucher)' : $text;
    }

    /** Fee dari voucher hak admin yang dipakai di pesanan selesai. */
    private function salesFees(User $user): Collection
    {
        return Order::with('voucher')
            ->where('status', 'completed')
            ->where('voucher_fee', '>', 0)
            ->whereHas('voucher', fn ($q) => $q->where('user_id', $user->id)->where('source', Voucher::SOURCE_GRANT))
            ->get()
            ->map(fn (Order $order) => [
                'type' => 'sales_fee',
                'label' => self::TYPE_LABELS['sales_fee'],
                'title' => 'Voucher '.$order->voucher_code,
                'detail' => 'Pesanan '.$order->order_number,
                'amount' => (float) $order->voucher_fee,
                'date' => $order->updated_at,
            ]);
    }
}
