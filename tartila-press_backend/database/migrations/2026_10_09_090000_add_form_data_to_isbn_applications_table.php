<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Isian admin untuk formulir pengajuan ISBN (Perpusnas) yang menimpa
        // nilai bawaan yang dihitung dari naskah/buku.
        Schema::table('isbn_applications', function (Blueprint $table) {
            $table->json('form_data')->nullable()->after('applicant_data');
        });
    }

    public function down(): void
    {
        Schema::table('isbn_applications', function (Blueprint $table) {
            $table->dropColumn('form_data');
        });
    }
};
