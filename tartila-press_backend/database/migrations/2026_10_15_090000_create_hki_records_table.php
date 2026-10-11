<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pengurusan HKI per karya: pesanan paket (order) atau buku/proyek
        // Book Chapter (book).
        Schema::create('hki_records', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 20);
            $table->unsignedBigInteger('subject_id');
            $table->string('status', 20)->default('pending');
            $table->string('application_number', 100)->nullable();
            $table->string('registration_number', 100)->nullable();
            $table->date('registered_at')->nullable();
            $table->string('certificate_path')->nullable();
            $table->string('certificate_name')->nullable();
            $table->timestamp('certificate_uploaded_at')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['subject_type', 'subject_id']);
        });

        // Biaya modal HKI untuk perhitungan keuangan (beda dengan biaya HKI
        // di harga proyek Book Chapter).
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->decimal('hki_cost', 15, 2)->default(220000);
        });
    }

    public function down(): void
    {
        Schema::table('finance_settings', fn (Blueprint $table) => $table->dropColumn('hki_cost'));
        Schema::dropIfExists('hki_records');
    }
};
