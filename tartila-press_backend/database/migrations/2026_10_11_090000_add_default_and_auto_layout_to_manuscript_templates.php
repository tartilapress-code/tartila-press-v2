<?php

use App\Support\ManuscriptTemplates\DefaultTemplates;
use App\Support\ManuscriptTemplates\TemplateSchema;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manuscript_templates', function (Blueprint $table) {
            $table->boolean('is_default')->default(false)->after('is_active');
        });

        // Template yang dipakai untuk naskah (dipilih penulis, atau admin
        // saat auto layout).
        Schema::table('manuscripts', function (Blueprint $table) {
            $table->foreignId('manuscript_template_id')->nullable()->constrained('manuscript_templates')->nullOnDelete();
        });

        // Template bawaan dari contoh buku "Embedded System".
        if (! DB::table('manuscript_templates')->where('is_default', true)->exists()) {
            DB::table('manuscript_templates')->insert([
                'name' => DefaultTemplates::EMBEDDED_SYSTEM_NAME,
                'description' => 'Mengikuti tata letak buku Embedded System: B5, Constantia 11 pt, judul bab di tengah, footer judul | nomor halaman.',
                'config' => json_encode(TemplateSchema::normalize(DefaultTemplates::embeddedSystem())),
                'is_active' => true,
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('manuscripts', function (Blueprint $table) {
            $table->dropForeign(['manuscript_template_id']);
            $table->dropColumn('manuscript_template_id');
        });

        Schema::table('manuscript_templates', function (Blueprint $table) {
            $table->dropColumn('is_default');
        });
    }
};
