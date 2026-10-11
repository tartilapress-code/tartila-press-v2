<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kapan sampul depan terakhir diunggah/diganti — tumpukan sampul di hero
     * beranda menaruh sampul terbaru paling depan. Buku lama memakai tanggal
     * dibuatnya.
     */
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->timestamp('front_cover_updated_at')->nullable();
        });

        DB::table('books')
            ->whereNotNull('front_cover')
            ->where('front_cover', '!=', '')
            ->update(['front_cover_updated_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn('front_cover_updated_at');
        });
    }
};
