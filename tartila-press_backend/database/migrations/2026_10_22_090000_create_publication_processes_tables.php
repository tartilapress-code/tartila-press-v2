<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Proses penerbitan sebuah karya setelah naskah selesai: pengajuan ISBN ke
 * Perpusnas (resi, ditolak + catatan, terbit), buku fisik (dicetak, dikirim,
 * sampai) dan riwayatnya. Subjek sama seperti HKI: pesanan paket
 * (subject_type "order") atau proyek Book Chapter / buku ("book").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_processes', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 10);
            $table->unsignedBigInteger('subject_id');

            $table->string('isbn_status', 20)->nullable();
            $table->string('isbn_receipt', 100)->nullable();
            $table->text('isbn_note')->nullable();
            $table->string('isbn_number', 40)->nullable();
            $table->timestamp('isbn_submitted_at')->nullable();
            $table->timestamp('isbn_rejected_at')->nullable();
            $table->timestamp('isbn_published_at')->nullable();

            // null = ikuti paket (otomatis); true/false = ditetapkan admin.
            $table->boolean('includes_physical')->nullable();
            $table->string('physical_status', 20)->nullable();
            $table->text('physical_note')->nullable();
            $table->timestamp('printed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['subject_type', 'subject_id']);
        });

        Schema::create('publication_process_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('publication_process_id')->constrained()->cascadeOnDelete();
            $table->string('stage', 30);
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['publication_process_id', 'created_at'], 'pub_process_events_process_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_process_events');
        Schema::dropIfExists('publication_processes');
    }
};
