<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            // Yang didapatkan penulis di proyek Book Chapter (dipilih admin/editor).
            $table->boolean('includes_hki')->default(false)->after('services');
            $table->boolean('includes_isbn_print')->default(false)->after('includes_hki');
            $table->boolean('includes_isbn_electronic')->default(false)->after('includes_isbn_print');
        });

        // Fasilitas & layanan yang dicentang, diambil dari daftar item paket custom.
        Schema::create('book_package_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('custom_package_item_id')
                ->constrained('custom_package_items')
                ->cascadeOnDelete();

            $table->unique(['book_id', 'custom_package_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('book_package_items');

        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn([
                'includes_hki',
                'includes_isbn_print',
                'includes_isbn_electronic',
            ]);
        });
    }
};
