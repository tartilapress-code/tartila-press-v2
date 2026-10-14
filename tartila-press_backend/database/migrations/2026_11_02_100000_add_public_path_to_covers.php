<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('covers', function (Blueprint $table) {
            // Salinan publik cover yang dipakai (cover awal Book Chapter / cover final), tetap ada setelah berkas lain dihapus.
            $table->string('public_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('covers', fn (Blueprint $table) => $table->dropColumn('public_path'));
    }
};
