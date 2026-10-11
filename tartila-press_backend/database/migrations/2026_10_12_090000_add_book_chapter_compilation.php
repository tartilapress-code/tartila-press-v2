<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Naskah gabungan Book Chapter tidak berasal dari satu pesanan.
        Schema::table('manuscripts', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable()->change();

            $table->foreignId('compiled_book_id')
                ->nullable()
                ->unique()
                ->constrained('books')
                ->nullOnDelete();
        });

        // Catatan revisi per bab dari editor/admin untuk penulis bab itu.
        Schema::create('chapter_revision_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compilation_id')->constrained('manuscripts')->cascadeOnDelete();
            $table->foreignId('manuscript_id')->constrained('manuscripts')->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['manuscript_id', 'resolved_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chapter_revision_requests');

        Schema::table('manuscripts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('compiled_book_id');
        });
    }
};
