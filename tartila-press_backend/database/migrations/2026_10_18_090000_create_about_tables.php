<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Halaman "Tentang Kami" (satu baris): visi, misi, profil, kontak,
        // sosial media, alamat + peta, dan pilihan menampilkan tim.
        Schema::create('about_profiles', function (Blueprint $table) {
            $table->id();
            $table->text('vision')->nullable();
            $table->text('mission')->nullable();
            $table->text('profile')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('whatsapp', 30)->nullable();
            $table->text('address')->nullable();
            $table->string('map_query', 500)->nullable();
            $table->json('social_links')->nullable();
            $table->boolean('show_team')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Legalitas usaha (akta, NIB, SK, dst.) beserta fotonya.
        Schema::create('about_legalities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Tim Kami: tiap anggota bisa disembunyikan dan diurutkan.
        Schema::create('about_team_members', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('photo_url', 500)->nullable();
            $table->string('position')->nullable();
            $table->string('expertise', 500)->nullable();
            $table->boolean('is_visible')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Isi awal = kontak yang selama ini tertulis di footer situs.
        DB::table('about_profiles')->insert([
            'contact_email' => 'tartilapress@gmail.com',
            'phone' => '+62 812-7034-8598',
            'whatsapp' => '6283180773955',
            'address' => 'Indonesia',
            'social_links' => json_encode([
                'instagram' => 'https://instagram.com',
                'facebook' => 'https://facebook.com',
                'tiktok' => 'https://tiktok.com',
                'youtube' => 'https://youtube.com',
            ]),
            'show_team' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('about_team_members');
        Schema::dropIfExists('about_legalities');
        Schema::dropIfExists('about_profiles');
    }
};
