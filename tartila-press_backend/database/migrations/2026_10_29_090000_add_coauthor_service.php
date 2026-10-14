<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Layanan co-author: penulis yang punya naskah mentah dibantu disusun oleh co-author (seorang
 * editor yang mencentang "co-author"), lalu dikoreksi editor (orang berbeda).
 *  - editor_profiles : centang co-author, fee mandiri, keterangan.
 *  - orders          : penulis memilih layanan (wants_coauthor) dan, opsional, co-author-nya + fee.
 *  - manuscripts     : penugasan co-author (mirip editor: admin / pool / dipilih penulis), fase kerjanya.
 *  - manuscript_authors / mou_signatories : co-author tercatat sebagai penulis TERAKHIR.
 *  - mou_templates   : jatah royalti tetap co-author (bawaan 5% untuk buku fisik dan ebook).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('editor_profiles', function (Blueprint $table) {
            $table->boolean('is_coauthor')->default(false);
            $table->decimal('coauthor_fee', 14, 2)->default(0);
            $table->text('coauthor_bio')->nullable();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('wants_coauthor')->default(false);
            $table->foreignId('coauthor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('coauthor_fee', 14, 2)->default(0);
        });

        Schema::table('manuscripts', function (Blueprint $table) {
            $table->boolean('wants_coauthor')->default(false);
            $table->foreignId('coauthor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('coauthor_source', 20)->nullable();
            $table->decimal('coauthor_fee', 14, 2)->nullable();
            $table->decimal('coauthor_requested_fee', 14, 2)->nullable();
            $table->date('coauthor_deadline')->nullable();
            $table->text('coauthor_assignment_note')->nullable();
            $table->boolean('coauthor_open_for_claim')->default(false);
            // Fee tambahan admin untuk editor pilihan penulis, disimpan sampai tahap editor dimulai.
            $table->decimal('editor_admin_fee_pending', 14, 2)->nullable();
        });

        Schema::table('manuscript_authors', function (Blueprint $table) {
            $table->boolean('is_coauthor')->default(false);
        });

        Schema::table('mou_signatories', function (Blueprint $table) {
            $table->boolean('is_coauthor')->default(false);
        });

        Schema::table('mou_templates', function (Blueprint $table) {
            $table->decimal('coauthor_royalty', 6, 2)->default(5);
        });
    }

    public function down(): void
    {
        Schema::table('mou_templates', fn (Blueprint $table) => $table->dropColumn('coauthor_royalty'));
        Schema::table('mou_signatories', fn (Blueprint $table) => $table->dropColumn('is_coauthor'));
        Schema::table('manuscript_authors', fn (Blueprint $table) => $table->dropColumn('is_coauthor'));

        Schema::table('manuscripts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coauthor_id');
            $table->dropColumn([
                'wants_coauthor', 'coauthor_source', 'coauthor_fee', 'coauthor_requested_fee', 'coauthor_deadline',
                'coauthor_assignment_note', 'coauthor_open_for_claim', 'editor_admin_fee_pending',
            ]);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coauthor_id');
            $table->dropColumn(['wants_coauthor', 'coauthor_fee']);
        });

        Schema::table('editor_profiles', fn (Blueprint $table) => $table->dropColumn(['is_coauthor', 'coauthor_fee', 'coauthor_bio']));
    }
};
