<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custom_package_items', function (Blueprint $table) {
            // Biaya item ini bila dipakai di proyek Book Chapter. Kosong = gratis.
            $table->decimal('book_chapter_cost', 12, 2)->nullable()->after('discount');
        });
    }

    public function down(): void
    {
        Schema::table('custom_package_items', function (Blueprint $table) {
            $table->dropColumn('book_chapter_cost');
        });
    }
};
