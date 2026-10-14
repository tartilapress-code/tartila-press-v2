<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catatan penulis saat meminta revisi lagi (sebelum persetujuan akhir) disimpan terpisah dari
 * catatan admin, supaya tampil sebagai "Catatan penulis", bukan "Catatan admin".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manuscript_revisions', function (Blueprint $table) {
            $table->text('author_note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('manuscript_revisions', fn (Blueprint $table) => $table->dropColumn('author_note'));
    }
};
