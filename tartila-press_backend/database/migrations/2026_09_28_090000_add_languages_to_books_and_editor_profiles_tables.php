<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bahasa isi buku / proyek Book Chapter — daftar kode ISO, mis. ["id","en"].
        Schema::table('books', function (Blueprint $table) {
            $table->json('languages')->nullable()->after('about');
        });

        // Bahasa yang dikuasai editor (tampil saat penulis memilih editor).
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->json('languages')->nullable()->after('bio');
        });
    }

    public function down(): void
    {
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->dropColumn('languages');
        });

        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn('languages');
        });
    }
};
