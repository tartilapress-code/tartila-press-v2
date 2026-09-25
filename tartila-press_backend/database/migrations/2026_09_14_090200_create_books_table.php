<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table) {
            $table->id();

            $table->foreignId('manuscript_id')
                ->nullable()
                ->unique()
                ->constrained()
                ->nullOnDelete();

            $table->string('title');
            $table->json('authors')->nullable();
            $table->string('authors_text')->nullable();

            $table->string('isbn')->nullable();
            $table->string('front_cover')->nullable();
            $table->string('back_cover')->nullable();
            $table->text('description')->nullable();

            $table->foreignId('book_category_id')
                ->nullable()
                ->constrained('book_categories')
                ->nullOnDelete();

            $table->foreignId('field_category_id')
                ->nullable()
                ->constrained('field_categories')
                ->nullOnDelete();

            $table->decimal('price', 12, 2)->default(0);
            $table->unsignedTinyInteger('discount')->default(0);

            $table->string('preview_file')->nullable();

            $table->string('citation_publisher')->default('Tartila Press');
            $table->date('citation_publication_date')->nullable();
            $table->string('google_scholar_url')->nullable();

            $table->boolean('is_chapter_compilation')->default(false);
            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('books');
    }
};
