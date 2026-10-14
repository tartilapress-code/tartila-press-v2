<?php

namespace App\Services;

use App\Models\Book;
use App\Models\CustomPackageItem;
use App\Models\Order;
use App\Models\Package;
use App\Models\Scopes\ExcludePartnerBooks;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class VoucherService
{
    /** Jenis produk yang bisa dijadikan target voucher. */
    public const TARGET_TYPES = ['all', 'package', 'custom_item', 'book'];

    public const TARGET_LABELS = [
        'all' => 'Semua produk',
        'package' => 'Paket',
        'custom_item' => 'Layanan',
        'book' => 'Buku / Book Chapter',
    ];

    private const REJECTION = [
        'reset' => 'Voucher ini sudah direset dan tidak bisa dipakai lagi.',
        'inactive' => 'Voucher ini sudah tidak aktif.',
        'scheduled' => 'Voucher ini belum berlaku.',
        'expired' => 'Masa berlaku voucher ini sudah habis.',
        'exhausted' => 'Kuota pemakaian voucher ini sudah habis.',
    ];

    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(private readonly BookRoyaltyService $royalty) {}

    /**
     * Cari voucher dari kode dan pastikan masih bisa dipakai (422 kalau tidak).
     * $lock = true saat dipakai di dalam transaksi pesanan supaya kuota
     * pemakaian tidak terlewati oleh dua pesanan bersamaan.
     */
    public function findUsable(string $code, bool $lock = false): Voucher
    {
        $query = Voucher::with('grant')->where('code', Voucher::normalizeCode($code));

        if ($lock) {
            $query->lockForUpdate();
        }

        $voucher = $query->first();

        abort_unless($voucher, 422, 'Kode voucher tidak ditemukan.');

        $status = $voucher->status();

        abort_unless($status === 'active', 422, self::REJECTION[$status] ?? 'Voucher tidak bisa dipakai.');

        return $voucher;
    }

    /**
     * Hitung potongan voucher untuk daftar item pesanan. Tiap item memuat
     * subtotal (harga sebelum diskon), discount (diskon produk), target_type
     * dan target_id. Potongan = persen dari harga asli, tapi tidak melebihi
     * sisa harga setelah diskon produk. Fee pembuat dihitung dari harga asli
     * item yang terkena voucher.
     *
     * @param  list<array<string, mixed>>  $items
     * @return array{lines: array<int, float>, discount: float, fee: float}
     */
    public function quote(Voucher $voucher, array $items): array
    {
        $lines = [];
        $discount = 0.0;
        $fee = 0.0;

        foreach ($items as $index => $item) {
            if (! $voucher->appliesTo($item['target_type'], (int) $item['target_id'])) {
                continue;
            }

            $base = (float) $item['subtotal'];
            $room = max(0.0, $base - (float) ($item['discount'] ?? 0));
            $line = round(min($base * (float) $voucher->discount_percent / 100, $room), 2);

            $lines[$index] = $line;
            $discount += $line;
            $fee += $base * (float) $voucher->fee_percent / 100;
        }

        return [
            'lines' => $lines,
            'discount' => round($discount, 2),
            'fee' => round($fee, 2),
        ];
    }

    /** Apakah user punya buku terbit (sebagai penulis atau editor)? */
    public function hasPublishedBook(User $user): bool
    {
        return Book::publishedByAuthor($user->id)->exists()
            || Book::publishedByEditor($user->id)->exists();
    }

    /**
     * Buku terbit user yang menghasilkan royalti, beserta persentase royalti
     * dan perannya — dasar voucher "dari royalti".
     *
     * @return Collection<int, array{book: Book, rate: float, role: string}>
     */
    public function royaltyBooks(User $user): Collection
    {
        $books = Book::with(BookRoyaltyService::SHARE_RELATIONS)
            ->publishedByAuthor($user->id)->get()
            ->merge(
                Book::with(BookRoyaltyService::SHARE_RELATIONS)
                    ->where('is_active', true)
                    ->where('owner_editor_id', $user->id)
                    ->get()
            )
            // Buku mitra yang sudah disetujui: penulisnya (akun) dan mitranya.
            ->merge(
                Book::withoutGlobalScope(ExcludePartnerBooks::class)
                    ->with(BookRoyaltyService::SHARE_RELATIONS)
                    ->where('partner_status', 'approved')
                    ->where(fn ($query) => $query
                        ->whereHas('partnerAuthors', fn ($authors) => $authors->where('users.id', $user->id))
                        ->orWhereHas('partner', fn ($partner) => $partner->where('user_id', $user->id)))
                    ->get()
            )
            ->unique('id');

        $rows = collect();

        foreach ($books as $book) {
            $rate = 0.0;
            $ebookRate = 0.0;
            $role = 'author';

            foreach ($this->royalty->shares($book) as $share) {
                if ($share['user_id'] === $user->id) {
                    $rate += $share['rate'];
                    $ebookRate += $share['ebook_rate'] ?? $share['rate'];
                    $role = $share['role'];
                }
            }

            if ($rate > 0 || $ebookRate > 0) {
                $rows->push(['book' => $book, 'rate' => round($rate, 2), 'ebook_rate' => round($ebookRate, 2), 'role' => $role]);
            }
        }

        return $rows->values();
    }

    /**
     * Rapikan daftar target dari input: buang duplikat dan 'all' menggantikan
     * yang lain.
     *
     * @param  list<array{type: string, id?: int|null}>  $targets
     * @return list<array{type: string, id: int|null}>
     */
    public function normalizeTargets(array $targets): array
    {
        $clean = [];

        foreach ($targets as $target) {
            $type = $target['type'];
            $id = $type === 'all' ? null : ($target['id'] ?? null);
            $clean[$type.':'.($id ?? '*')] = ['type' => $type, 'id' => $id !== null ? (int) $id : null];
        }

        foreach ($clean as $row) {
            if ($row['type'] === 'all') {
                return [$row];
            }
        }

        return array_values($clean);
    }

    /** Apakah semua id target ada di database? */
    public function targetsExist(array $targets): bool
    {
        foreach ($targets as $target) {
            if ($target['id'] === null) {
                continue;
            }

            $exists = match ($target['type']) {
                'package' => Package::whereKey($target['id'])->exists(),
                'custom_item' => CustomPackageItem::whereKey($target['id'])->exists(),
                'book' => Book::whereKey($target['id'])->exists(),
                default => false,
            };

            if (! $exists) {
                return false;
            }
        }

        return true;
    }

    /**
     * Teks label tiap target ("Paket: Paket A", "Semua paket", ...).
     *
     * @param  list<array{type: string, id: int|null}>  $targets
     * @return list<array{type: string, id: int|null, label: string}>
     */
    public function labels(array $targets): array
    {
        return $this->labelsMany([$targets])[0];
    }

    /**
     * Label untuk banyak daftar target sekaligus (paling banyak 3 query untuk
     * seluruh daftar voucher, bukan 3 query per voucher).
     *
     * @param  array<int|string, array|null>  $targetLists
     * @return array<int|string, array>
     */
    public function labelsMany(array $targetLists): array
    {
        $all = array_merge([], ...array_values(array_map(fn ($targets) => $targets ?? [], $targetLists)));
        $lookup = fn (string $model, string $type, string $column) => ($ids = array_unique($this->ids($all, $type)))
            ? $model::whereIn('id', $ids)->pluck($column, 'id')
            : collect();

        $names = [
            'package' => $lookup(Package::class, 'package', 'name'),
            'custom_item' => $lookup(CustomPackageItem::class, 'custom_item', 'name'),
            'book' => $lookup(Book::class, 'book', 'title'),
        ];

        return array_map(fn ($targets) => $this->labelTargets($targets ?? [], $names), $targetLists);
    }

    /** @param  array<string, Collection<int, string>>  $names */
    private function labelTargets(array $targets, array $names): array
    {
        return array_map(function (array $target) use ($names) {
            $type = $target['type'];

            if ($type === 'all') {
                $label = self::TARGET_LABELS['all'];
            } elseif ($target['id'] === null) {
                $label = 'Semua '.Str::lower(self::TARGET_LABELS[$type]);
            } else {
                $label = self::TARGET_LABELS[$type].': '.($names[$type][$target['id']] ?? '(dihapus)');
            }

            return $target + ['label' => $label];
        }, $targets);
    }

    /** Kode acak yang mudah dibaca (tanpa 0/O/1/I), dijamin belum dipakai. */
    public function generateCode(string $prefix = 'TP'): string
    {
        do {
            $suffix = '';

            for ($i = 0; $i < 6; $i++) {
                $suffix .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }

            $code = $prefix.$suffix;
        } while (Voucher::where('code', $code)->exists());

        return $code;
    }

    /**
     * Statistik pemakaian per voucher: berapa pesanan (tidak dibatalkan),
     * berapa yang sudah selesai, serta fee pembuat dan potongan yang sudah
     * cair dari pesanan selesai.
     *
     * @param  list<int>  $voucherIds
     * @return array<int, array{uses: int, completed: int, fee: float, discount: float}>
     */
    public function usage(array $voucherIds): array
    {
        $stats = [];

        foreach ($voucherIds as $id) {
            $stats[$id] = ['uses' => 0, 'completed' => 0, 'fee' => 0.0, 'discount' => 0.0];
        }

        $orders = Order::whereIn('voucher_id', $voucherIds)
            ->where('status', '!=', 'cancelled')
            ->get(['voucher_id', 'status', 'voucher_fee', 'voucher_discount']);

        foreach ($orders as $order) {
            $stats[$order->voucher_id]['uses']++;

            if ($order->status === 'completed') {
                $stats[$order->voucher_id]['completed']++;
                $stats[$order->voucher_id]['fee'] += (float) $order->voucher_fee;
                $stats[$order->voucher_id]['discount'] += (float) $order->voucher_discount;
            }
        }

        return $stats;
    }

    /**
     * Bentuk voucher untuk respons API (tanpa data internal pesanan).
     *
     * @param  array{uses: int, completed: int, fee: float, discount: float}|null  $usage
     */
    public function present(Voucher $voucher, ?array $usage = null, ?array $targets = null): array
    {
        $usage ??= $this->usage([$voucher->id])[$voucher->id];

        return [
            'id' => $voucher->id,
            'code' => $voucher->code,
            'source' => $voucher->source,
            'name' => $voucher->name,
            'user_id' => $voucher->user_id,
            'user_name' => $voucher->user?->name,
            'grant_id' => $voucher->grant_id,
            'targets' => $targets ?? $this->labels($voucher->targets ?? []),
            'discount_percent' => (float) $voucher->discount_percent,
            'fee_percent' => (float) $voucher->fee_percent,
            'max_uses' => $voucher->max_uses,
            'cycle' => $voucher->cycle,
            'starts_at' => $voucher->starts_at,
            'expires_at' => $voucher->expires_at,
            'is_active' => $voucher->is_active,
            'reset_at' => $voucher->reset_at,
            'status' => $voucher->status(uses: $usage['uses']),
            'uses' => $usage['uses'],
            'completed_uses' => $usage['completed'],
            'fee_earned' => round($usage['fee'], 2),
            'discount_given' => round($usage['discount'], 2),
            'created_at' => $voucher->created_at,
        ];
    }

    /** @return list<int> */
    private function ids(array $targets, string $type): array
    {
        return array_values(array_filter(
            array_map(fn ($t) => $t['type'] === $type ? $t['id'] : null, $targets)
        ));
    }
}
