<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Buku, paket dan event dulu ikut TERHAPUS bila akun admin pembuatnya
     * dihapus (ON DELETE CASCADE). Sekarang kolom created_by cukup dikosongkan
     * (SET NULL) sehingga katalog, pesanan dan laporan tetap utuh.
     */
    private const TABLES = ['books', 'packages', 'events'];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['created_by']);
            });

            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->change();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['created_by']);
            });

            // Baris yang pembuatnya sudah terhapus tidak bisa kembali NOT NULL.
            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable(false)->change();
                $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }
};
