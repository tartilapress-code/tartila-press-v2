<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_content_blocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('chapter_id')->constrained('pub_manuscript_chapters')->cascadeOnDelete();

            // heading, paragraph, image, table, quote, citation, dll
            $table->string('type');
            $table->unsignedInteger('order')->default(0);

            // Isi blok: teks rich-text, path gambar, data tabel, dsb
            // tergantung "type"
            $table->jsonb('content');

            $table->timestamps();

            $table->index(['chapter_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_content_blocks');
    }
};
