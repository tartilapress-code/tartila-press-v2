<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->id();

            // event = sertifikat peserta event; publication = sertifikat
            // penulis/editor buku.
            $table->string('type', 20);
            $table->string('name', 150);

            // Hanya untuk type publication: author / editor. Kosong = berlaku
            // untuk keduanya.
            $table->string('role', 20)->nullable();

            // Gambar templat di disk public (path relatif, bukan URL), sudah
            // dinormalisasi saat diunggah.
            $table->string('image_path');
            $table->unsignedInteger('image_width');
            $table->unsignedInteger('image_height');

            // Daftar kolom teks yang ditandai admin: posisi (pecahan 0..1
            // dari lebar/tinggi halaman), font, ukuran, warna, dst.
            $table->json('fields');

            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_templates');
    }
};
