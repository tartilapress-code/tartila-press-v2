<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kelola Editor (admin): editor bisa diberi status "dalam pemantauan" (tidak bisa mengambil naskah
 * dari pool, dan penulis/admin diperingatkan saat memilihnya) dan "dipromosikan" (tampil teratas
 * saat penulis memilih editor dan di profil publik editor, maksimal 3 teratas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->boolean('is_banned')->default(false);
            $table->timestamp('banned_at')->nullable();
            $table->text('ban_note')->nullable();
            $table->boolean('is_promoted')->default(false);
            $table->timestamp('promoted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->dropColumn(['is_banned', 'banned_at', 'ban_note', 'is_promoted', 'promoted_at']);
        });
    }
};
