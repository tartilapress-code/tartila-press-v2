<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Notifikasi di aplikasi (lonceng + tanda merah di menu).
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Menu tempat tanda merah muncul: order, manuscript, admin_order, ...
            $table->string('category', 40);
            $table->string('title');
            $table->text('body')->nullable();
            // Path halaman frontend, mis. /dashboard/naskah/12.
            $table->string('link')->nullable();
            // Objek yang diperbarui (untuk titik merah per baris di daftar).
            $table->string('subject_type', 40)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
