<?php

namespace App\Support;

use App\Models\Order;
use App\Models\Reader\ReaderOrder;
use Illuminate\Support\Carbon;

/**
 * Nomor pesanan: ORD-YYYYMMDD-NNNK
 *   YYYYMMDD = tanggal pemesanan (WIB), NNN = nomor urut pada hari itu (dihitung bersama untuk
 *   Tartila Press dan Tartila Book), K = kode jenis pesanan:
 *   P paket, BC book chapter, BF buku fisik, E event, L langganan, EB ebook.
 * Contoh: ORD-20261013-001P. Nomor lama (acak) tetap berlaku.
 */
class OrderNumber
{
    public const PACKAGE = 'P';

    public const BOOK_CHAPTER = 'BC';

    public const PHYSICAL_BOOK = 'BF';

    public const EVENT = 'E';

    public const SUBSCRIPTION = 'L';

    public const EBOOK = 'EB';

    /** Kode jenis untuk tipe pesanan Tartila Press (`type` pada pembuatan pesanan). */
    public static function codeForOrderType(string $type): string
    {
        return match ($type) {
            'book_chapter' => self::BOOK_CHAPTER,
            'book' => self::PHYSICAL_BOOK,
            'event' => self::EVENT,
            default => self::PACKAGE,
        };
    }

    public static function make(string $code, ?Carbon $at = null): string
    {
        $date = ($at ?? now())->copy()->timezone('Asia/Jakarta')->format('Ymd');
        $prefix = "ORD-{$date}-";

        $numbers = Order::where('order_number', 'like', $prefix.'%')->pluck('order_number')
            ->merge(ReaderOrder::where('order_number', 'like', $prefix.'%')->pluck('order_number'));

        $last = $numbers
            ->map(fn (string $number) => preg_match('/^ORD-\d{8}-(\d+)[A-Z]+$/', $number, $match) ? (int) $match[1] : 0)
            ->max() ?? 0;

        return $prefix.str_pad((string) ($last + 1), 3, '0', STR_PAD_LEFT).$code;
    }
}
