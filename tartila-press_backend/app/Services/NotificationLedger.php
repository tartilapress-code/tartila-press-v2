<?php

namespace App\Services;

/**
 * Catatan per permintaan HTTP: peristiwa yang sudah diberitahukan. Model
 * yang disimpan beberapa kali dalam satu transaksi memicu beberapa event
 * "afterCommit" sekaligus; tanpa ini notifikasinya bisa dobel. Disimpan di
 * objek request supaya tiap permintaan mulai dari catatan kosong.
 */
class NotificationLedger
{
    private const KEY = '_notification_ledger';

    /** true hanya pertama kali kunci ini dilihat dalam permintaan ini. */
    public function once(string $key): bool
    {
        $attributes = request()->attributes;
        $seen = (array) $attributes->get(self::KEY, []);

        if (isset($seen[$key])) {
            return false;
        }

        $seen[$key] = true;
        $attributes->set(self::KEY, $seen);

        return true;
    }
}
