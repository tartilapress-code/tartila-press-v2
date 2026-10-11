<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();

            // Diisi setelah baris dibuat (memakai id-nya), mis. TP-EVT-2026-000012.
            $table->string('number', 40)->nullable()->unique();

            // event = dari absensi event; publication = penulis/editor buku.
            $table->string('type', 20);

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('event_attendance_id')
                ->nullable()
                ->unique()
                ->constrained('event_attendances')
                ->cascadeOnDelete();

            $table->foreignId('book_id')
                ->nullable()
                ->constrained()
                ->cascadeOnDelete();

            // author / editor, hanya untuk type publication.
            $table->string('role', 20)->nullable();

            $table->dateTime('issued_at');

            $table->timestamps();

            $table->unique(['book_id', 'user_id', 'role']);
            $table->index(['user_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
