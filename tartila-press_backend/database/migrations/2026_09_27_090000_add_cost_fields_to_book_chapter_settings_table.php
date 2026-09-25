<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('book_chapter_settings', function (Blueprint $table) {
            // Biaya yang dipotong dari total harga bab (bila dipilih pada proyek).
            $table->decimal('hki_cost', 12, 2)->default(0)->after('max_discount');
            $table->decimal('isbn_print_cost', 12, 2)->default(0)->after('hki_cost');
            $table->decimal('isbn_electronic_cost', 12, 2)->default(0)->after('isbn_print_cost');

            // Sisa setelah dipotong biaya-biaya di atas minimal segini per buku.
            $table->decimal('min_book_cost', 12, 2)->default(0)->after('isbn_electronic_cost');
        });
    }

    public function down(): void
    {
        Schema::table('book_chapter_settings', function (Blueprint $table) {
            $table->dropColumn([
                'hki_cost',
                'isbn_print_cost',
                'isbn_electronic_cost',
                'min_book_cost',
            ]);
        });
    }
};
