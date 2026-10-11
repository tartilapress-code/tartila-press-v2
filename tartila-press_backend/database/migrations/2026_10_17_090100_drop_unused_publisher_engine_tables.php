<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Publisher Engine" (tabel pub_*) tidak pernah dipakai — penataan naskah
     * memakai Template Naskah (auto layout .docx). Migrasi pembuatnya sudah
     * dihapus; tabel yang terlanjur dibuat di database lama ikut dihapus.
     * Urutan: tabel anak dulu (foreign key).
     */
    public function up(): void
    {
        foreach ([
            'pub_content_blocks',
            'pub_references',
            'pub_manuscript_chapters',
            'pub_manuscript_metadata',
            'pub_manuscripts',
            'pub_templates',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        // Catatan migrasi pembuat tabel itu (berkasnya sudah tidak ada).
        DB::table('migrations')->where('migration', 'like', '2025_01_01_00000%_create_pub_%')->delete();
    }

    public function down(): void {}
};
