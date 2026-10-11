<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Invoice pesanan: nomor invoice (INV-YYYYMMDD-000ID) dan batas waktu
     * pembayaran (1×24 jam sejak pesanan dibuat). Pesanan baru yang belum
     * mengunggah bukti transfer sampai batas itu dibatalkan otomatis.
     * Pesanan lama hanya diberi nomor invoice; batas bayarnya dibiarkan kosong
     * supaya tidak ada pesanan lama yang tiba-tiba dibatalkan.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('invoice_number')->nullable()->unique()->after('order_number');
            $table->timestamp('payment_due_at')->nullable()->index()->after('payment_method_id');
        });

        DB::table('orders')->whereNull('invoice_number')->orderBy('id')->get(['id', 'created_at'])
            ->each(fn ($order) => DB::table('orders')->where('id', $order->id)->update([
                'invoice_number' => sprintf('INV-%s-%05d', date('Ymd', strtotime((string) $order->created_at)), $order->id),
            ]));
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['invoice_number']);
            $table->dropIndex(['payment_due_at']);
            $table->dropColumn(['invoice_number', 'payment_due_at']);
        });
    }
};
