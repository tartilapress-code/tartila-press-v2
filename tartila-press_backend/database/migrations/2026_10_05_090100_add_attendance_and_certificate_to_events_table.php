<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->boolean('attendance_enabled')->default(false)->after('certificate_url');
            $table->dateTime('attendance_opens_at')->nullable()->after('attendance_enabled');
            $table->dateTime('attendance_closes_at')->nullable()->after('attendance_opens_at');

            // Templat sertifikat otomatis; peserta yang sudah mengisi absensi
            // bisa mengunduhnya.
            $table->foreignId('certificate_template_id')
                ->nullable()
                ->after('attendance_closes_at')
                ->constrained('certificate_templates')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign(['certificate_template_id']);
            $table->dropColumn([
                'attendance_enabled',
                'attendance_opens_at',
                'attendance_closes_at',
                'certificate_template_id',
            ]);
        });
    }
};
