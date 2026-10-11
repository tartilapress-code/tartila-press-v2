<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_attendance_fields', function (Blueprint $table) {
            $table->id();

            $table->foreignId('event_id')
                ->constrained()
                ->cascadeOnDelete();

            // Kunci tetap (slug dari label saat dibuat): jawaban peserta
            // disimpan per kunci, dan di sertifikat dipakai sebagai
            // {answer_<kunci>}.
            $table->string('key', 60);
            $table->string('label', 150);
            $table->string('type', 20);
            $table->json('options')->nullable();
            $table->boolean('required')->default(true);
            $table->string('help_text')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();

            $table->unique(['event_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_attendance_fields');
    }
};
