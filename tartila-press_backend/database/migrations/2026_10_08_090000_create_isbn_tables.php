<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pengaturan surat ISBN (satu baris): data penerbit, kop, teks
        // surat yang bisa diubah admin, dan berkas tanda tangan/stempel
        // penanggung jawab (disimpan di disk privat).
        Schema::create('isbn_letter_settings', function (Blueprint $table) {
            $table->id();
            $table->string('city')->default('Batam');
            $table->string('publisher_name')->default('Tartila Press');
            $table->text('publisher_address');
            $table->string('website')->nullable();
            $table->string('email')->nullable();
            $table->string('responsible_name');
            $table->string('admin_name')->nullable();
            $table->string('letter_code')->default('PISBN/TP');
            $table->string('subject');
            $table->text('recipient');
            $table->text('application_body');
            $table->text('application_closing');
            $table->text('statement_body');
            $table->text('statement_closing');
            $table->string('logo_path')->nullable();
            $table->string('signature_path')->nullable();
            $table->string('stamp_path')->nullable();
            $table->timestamps();
        });

        // Satu permohonan ISBN per naskah (paket biasa) atau per proyek
        // Book Chapter. applicant = penanda tangan surat keaslian karya
        // (penulis pertama / editor).
        Schema::create('isbn_applications', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->foreignId('manuscript_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('book_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('applicant_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('authors_text');
            $table->string('availability_link')->nullable();
            $table->string('letter_number');
            $table->date('letter_date');
            $table->json('applicant_data');
            $table->string('signature_path')->nullable();
            $table->dateTime('signed_at')->nullable();
            $table->string('status', 20)->default('draft');
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('processed_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('isbn_applications');
        Schema::dropIfExists('isbn_letter_settings');
    }
};
