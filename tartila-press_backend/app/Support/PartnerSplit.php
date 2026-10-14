<?php

namespace App\Support;

/**
 * Pembagian hasil buku mitra Tartila Book (persen).
 *  - Pembelian ebook satuan : Tartila 20, mitra 30, penulis 50.
 *  - Langganan (bacaan)     : Tartila 10, perusahaan (mitra) 15, penulis 75.
 * Bagian penulis dibagi rata antar-penulis buku itu (semua penulis wajib punya akun).
 */
class PartnerSplit
{
    public const PURCHASE = ['tartila' => 20.0, 'partner' => 30.0, 'author' => 50.0];

    public const READ = ['tartila' => 10.0, 'partner' => 15.0, 'author' => 75.0];

    /** @return array{tartila: float, partner: float, author: float} */
    public static function for(string $system): array
    {
        return $system === 'read' ? self::READ : self::PURCHASE;
    }

    /** Persen yang dibagikan ke penulis + mitra (selain bagian Tartila). */
    public static function pool(string $system): float
    {
        $split = self::for($system);

        return $split['partner'] + $split['author'];
    }

    /**
     * Bobot (jumlah 1) tiap penerima dari kolam penulis + mitra.
     *
     * @param  list<int>  $authorIds
     * @return list<array{user_id: int, role: string, weight: float}>
     */
    public static function weights(string $system, array $authorIds, int $partnerUserId): array
    {
        $split = self::for($system);
        $pool = self::pool($system);
        $rows = [];

        foreach ($authorIds as $id) {
            $rows[] = ['user_id' => $id, 'role' => 'author', 'weight' => $split['author'] / max(1, count($authorIds)) / $pool];
        }

        $rows[] = ['user_id' => $partnerUserId, 'role' => 'partner', 'weight' => $split['partner'] / $pool];

        return $rows;
    }
}
