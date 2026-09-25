<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();

            // Struktur bagian buku: front_matter, chapters, back_matter,
            // termasuk field identitas & tipe blok yang diizinkan per bagian
            $table->jsonb('structure_config');

            // Aturan penomoran halaman per bagian (style, posisi, reset_at_start, dst)
            $table->jsonb('page_numbering_config')->nullable();

            // Tema visual: font, margin, warna aksen, ukuran kertas
            $table->jsonb('theme_config')->nullable();

            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_templates');
    }
};
