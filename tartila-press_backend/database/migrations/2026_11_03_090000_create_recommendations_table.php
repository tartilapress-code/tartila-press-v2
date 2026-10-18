<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rekomendasi: admin mem-pin maksimal 3 konten per menu (layanan, paket, Book Chapter,
     * buku, penulis, event, artikel). Konten yang di-pin tampil paling atas di menunya dan di
     * beranda. (Editor memakai mekanisme "Promosikan" yang sudah ada di Kelola Editor.)
     */
    public function up(): void
    {
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();
            $table->string('section', 30);
            // Id konten menurut bagian: item custom / paket / buku / artikel / event; penulis = id user.
            $table->unsignedBigInteger('item_id');
            $table->unsignedTinyInteger('position');
            $table->timestamps();

            $table->unique(['section', 'position']);
            $table->unique(['section', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recommendations');
    }
};
