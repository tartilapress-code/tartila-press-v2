<?php

use App\Models\Book;
use App\Models\CoverProject;
use App\Models\Scopes\ExcludePartnerBooks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cover khusus (admin): cover paket (3 pilihan, penulis memilih / voting), cover Book Chapter
 * (cover awal tunggal yang tampil publik, lalu 3 pilihan saat naskah gabungan siap), dan cover buku
 * terbit. Berkas pilihan, revisi, dan dokumen revisi dihapus 7 hari setelah buku terbit (riwayat tetap).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cover_projects', function (Blueprint $table) {
            $table->id();
            // package = naskah paket; chapter = proyek Book Chapter.
            $table->string('source', 20);
            // early = belum mendesak (cover awal Book Chapter); urgent = tagihan yang harus segera selesai.
            $table->string('stage', 20)->default('urgent');
            $table->foreignId('manuscript_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('book_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('title');
            // awaiting_upload -> voting -> (revision ->) approved
            $table->string('status', 20)->default('awaiting_upload');
            $table->unsignedInteger('round')->default(1);
            $table->timestamp('voting_opened_at')->nullable();
            $table->timestamp('voting_deadline_at')->nullable();
            $table->unsignedBigInteger('chosen_cover_id')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('purge_warned_at')->nullable();
            $table->timestamp('files_purged_at')->nullable();
            $table->timestamps();
        });

        Schema::create('covers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cover_project_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('round')->default(1);
            $table->unsignedTinyInteger('position')->default(1);
            // option | revision
            $table->string('kind', 20)->default('option');
            $table->unsignedBigInteger('parent_cover_id')->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_name')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('purged_at')->nullable();
            $table->timestamps();
        });

        Schema::create('cover_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cover_project_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('round');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // null = "revisi / buat ulang" (tidak ada yang cocok)
            $table->unsignedBigInteger('cover_id')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->unique(['cover_project_id', 'round', 'user_id']);
        });

        Schema::create('cover_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cover_project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('book_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('action', 30);
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        // Berkas revisi dihapus setelah buku terbit; barisnya tetap sebagai riwayat.
        Schema::table('manuscript_revisions', function (Blueprint $table) {
            $table->string('file_path')->nullable()->change();
            $table->timestamp('file_purged_at')->nullable();
        });

        // Proyek Book Chapter yang sudah ada langsung punya cover awal (belum mendesak).
        Book::withoutGlobalScope(ExcludePartnerBooks::class)->where('is_chapter_offering', true)->each(function (Book $book) {
            CoverProject::firstOrCreate(
                ['book_id' => $book->id],
                ['source' => 'chapter', 'stage' => 'early', 'title' => $book->title, 'status' => 'awaiting_upload']
            );
        });
    }

    public function down(): void
    {
        Schema::table('manuscript_revisions', function (Blueprint $table) {
            $table->dropColumn('file_purged_at');
        });

        Schema::dropIfExists('cover_events');
        Schema::dropIfExists('cover_votes');
        Schema::dropIfExists('covers');
        Schema::dropIfExists('cover_projects');
    }
};
