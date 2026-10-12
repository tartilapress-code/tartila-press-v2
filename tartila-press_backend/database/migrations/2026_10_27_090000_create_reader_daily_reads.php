<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jumlah bacaan terhitung per buku per hari. Laporan royalti per rentang tanggal dulu menghitung
 * COUNT(*) langsung dari reader_page_reads (puluhan juta baris): 58 detik untuk satu hari pada uji
 * beban (Lampiran H SRS). Kini cukup menjumlahkan tabel ringkas ini (satu baris per buku per hari).
 * Juga: indeks penutup untuk agregasi pesanan per buku.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reader_daily_reads', function (Blueprint $table) {
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->date('read_date');
            $table->unsignedBigInteger('events')->default(0);

            $table->primary(['reader_book_id', 'read_date']);
            $table->index('read_date');
        });

        DB::statement('INSERT INTO reader_daily_reads (reader_book_id, read_date, events)
            SELECT reader_book_id, read_date, COUNT(*) FROM reader_page_reads WHERE counted = 1 GROUP BY reader_book_id, read_date');

        Schema::table('reader_orders', function (Blueprint $table) {
            $table->index(['reader_book_id', 'kind', 'status', 'confirmed_at', 'amount'], 'reader_orders_book_kind_status_amount_index');
        });
    }

    public function down(): void
    {
        Schema::table('reader_orders', function (Blueprint $table) {
            $table->dropIndex('reader_orders_book_kind_status_amount_index');
        });

        Schema::dropIfExists('reader_daily_reads');
    }
};
