<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ebook lengkap (privat, hanya untuk penulis buku) — diunggah admin.
        Schema::table('books', function (Blueprint $table) {
            $table->string('ebook_file')->nullable();
            $table->string('ebook_name')->nullable();
            $table->timestamp('ebook_uploaded_at')->nullable();
        });

        // Tingkat kesulitan (diisi admin saat menerima naskah penulis) dan
        // kriteria editor pool: daftar id Kategori Keilmuan, kosong = umum.
        Schema::table('manuscripts', function (Blueprint $table) {
            $table->string('difficulty', 20)->nullable();
            $table->json('pool_field_category_ids')->nullable();
        });

        // Bidang keahlian editor (diatur admin) untuk kriteria pool naskah.
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->json('field_category_ids')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->dropColumn('field_category_ids');
        });

        Schema::table('manuscripts', function (Blueprint $table) {
            $table->dropColumn(['difficulty', 'pool_field_category_ids']);
        });

        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn(['ebook_file', 'ebook_name', 'ebook_uploaded_at']);
        });
    }
};
