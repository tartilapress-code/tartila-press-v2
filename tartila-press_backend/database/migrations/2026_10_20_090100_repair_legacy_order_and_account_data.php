<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Merapikan data lama (aman dijalankan berulang):
     *  1. Pesanan lunas (confirmed/completed) yang dibuat sebelum riwayat status ada
     *     belum punya peristiwa "payment_confirmed", sehingga laporan keuangan
     *     memakai updated_at yang bisa bergeser. Diisi dengan waktu paling awal
     *     yang diketahui: "order_completed" atau updated_at pesanan.
     *  2. Akun tanpa peran sama sekali diberi peran dasar "user" (seperti saat daftar).
     *  3. Token login milik akun yang sudah dihapus dibuang.
     */
    public function up(): void
    {
        $orders = DB::table('orders')
            ->whereIn('status', ['confirmed', 'completed'])
            ->whereNotExists(fn ($query) => $query->from('order_status_histories')
                ->whereColumn('order_status_histories.order_id', 'orders.id')
                ->where('event', 'payment_confirmed'))
            ->get(['id', 'created_at', 'updated_at']);

        foreach ($orders as $order) {
            $completedAt = DB::table('order_status_histories')
                ->where('order_id', $order->id)
                ->where('event', 'order_completed')
                ->min('created_at');

            $time = collect([$completedAt, $order->updated_at])->filter()->min() ?? $order->created_at;

            DB::table('order_status_histories')->insert([
                'order_id' => $order->id,
                'event' => 'payment_confirmed',
                'note' => 'Dicatat ulang dari data lama.',
                'created_at' => $time,
                'updated_at' => $time,
            ]);
        }

        $userRole = DB::table('roles')->where('name', 'user')->value('id');

        if ($userRole) {
            $roleless = DB::table('users')
                ->whereNotExists(fn ($query) => $query->from('role_user')
                    ->whereColumn('role_user.user_id', 'users.id'))
                ->pluck('id');

            foreach ($roleless as $userId) {
                DB::table('role_user')->insert([
                    'user_id' => $userId,
                    'role_id' => $userRole,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->whereNotExists(fn ($query) => $query->from('users')
                ->whereColumn('users.id', 'personal_access_tokens.tokenable_id'))
            ->delete();
    }

    public function down(): void
    {
        // Perbaikan data; tidak dibatalkan.
    }
};
