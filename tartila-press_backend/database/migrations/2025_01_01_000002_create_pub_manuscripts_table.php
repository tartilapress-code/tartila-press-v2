<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_manuscripts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('template_id')->constrained('pub_templates')->restrictOnDelete();

            $table->string('title');

            // draft: sedang disusun, in_review: menunggu review,
            // ready: siap diterbitkan, published: sudah pindah ke katalog
            $table->enum('status', ['draft', 'in_review', 'ready', 'published'])
                ->default('draft');

            // Diisi saat naskah resmi diterbitkan
            $table->string('isbn')->nullable();
            $table->timestamp('published_at')->nullable();

            // Link ke tabel katalog buku terbit yang sudah ada di sistem utama.
            // Nullable & tanpa foreign key lintas modul (id katalog buku existing)
            // supaya modul ini tetap independen dari skema tabel katalog.
            $table->unsignedBigInteger('published_book_id')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index('status');
            $table->index('published_book_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_manuscripts');
    }
};
