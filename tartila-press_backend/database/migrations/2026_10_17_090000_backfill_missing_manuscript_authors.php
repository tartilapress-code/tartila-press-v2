<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Naskah lama (sebelum fitur penulis bersama) tidak punya baris di
     * manuscript_authors, sehingga pengajunya tidak bisa melihat, membuka,
     * atau mengunggah revisi naskahnya sendiri. Pengaju dijadikan penulis
     * pertama; naskah yang sudah selesai dianggap sudah disetujui penulis.
     */
    public function up(): void
    {
        $now = now();

        DB::table('manuscripts')
            ->whereNotNull('user_id')
            ->whereIn('user_id', DB::table('users')->select('id'))
            ->whereNotIn('id', DB::table('manuscript_authors')->select('manuscript_id'))
            ->orderBy('id')
            ->get(['id', 'user_id', 'status', 'updated_at'])
            ->each(function ($manuscript) use ($now) {
                DB::table('manuscript_authors')->insert([
                    'manuscript_id' => $manuscript->id,
                    'user_id' => $manuscript->user_id,
                    'position' => 1,
                    'approved_at' => $manuscript->status === 'completed' ? ($manuscript->updated_at ?? $now) : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    // Tidak dibatalkan: baris yang ditambahkan tidak bisa dibedakan dari
    // penulis yang memang sah.
    public function down(): void {}
};
