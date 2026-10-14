<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis ISBN (cetak / digital / keduanya):
 *  - packages.isbn_prices : harga per jenis ISBN yang ditawarkan paket (kunci print|electronic|both);
 *    packages.price tetap = harga bawaan yang tampil (ISBN cetak, atau jenis pertama bila cetak tidak ditawarkan).
 *  - order_items.isbn_type : jenis ISBN yang dipilih pembeli saat memesan paket.
 *  - books.isbn_type       : jenis ISBN buku/proyek (menentukan MOU & royalti); includes_isbn_* tetap diisi.
 *  - book_chapter_settings : biaya minimal 1 buku per jenis ISBN.
 *  - mou_templates         : pilihan hak distribusi berupa daftar poin (bukan satu paragraf).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->json('isbn_prices')->nullable()->after('price');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('isbn_type', 12)->nullable()->after('name');
        });

        Schema::table('books', function (Blueprint $table) {
            $table->string('isbn_type', 12)->nullable()->after('includes_isbn_electronic');
        });

        Schema::table('book_chapter_settings', function (Blueprint $table) {
            $table->decimal('min_book_cost_print', 14, 2)->nullable()->after('min_book_cost');
            $table->decimal('min_book_cost_electronic', 14, 2)->nullable()->after('min_book_cost_print');
            $table->decimal('min_book_cost_both', 14, 2)->nullable()->after('min_book_cost_electronic');
        });

        // Paket lama = hanya ISBN cetak dengan harganya sekarang.
        DB::table('packages')->orderBy('id')->get(['id', 'price'])->each(function ($package) {
            DB::table('packages')->where('id', $package->id)->update([
                'isbn_prices' => json_encode(['print' => (float) $package->price]),
            ]);
        });

        // Buku/proyek lama: jenis dari centang ISBN yang sudah ada.
        DB::table('books')->where('includes_isbn_print', true)->where('includes_isbn_electronic', true)->update(['isbn_type' => 'both']);
        DB::table('books')->where('includes_isbn_print', true)->where('includes_isbn_electronic', false)->update(['isbn_type' => 'print']);
        DB::table('books')->where('includes_isbn_print', false)->where('includes_isbn_electronic', true)->update(['isbn_type' => 'electronic']);

        // Biaya minimal per jenis awalnya sama dengan nilai lama; admin menyesuaikan.
        DB::table('book_chapter_settings')->update([
            'min_book_cost_print' => DB::raw('min_book_cost'),
            'min_book_cost_electronic' => DB::raw('min_book_cost'),
            'min_book_cost_both' => DB::raw('min_book_cost'),
        ]);

        // Pilihan hak distribusi: pecah deskripsi paragraf menjadi poin per kalimat.
        DB::table('mou_templates')->get(['id', 'distribution_options'])->each(function ($template) {
            $options = json_decode((string) $template->distribution_options, true);

            if (! is_array($options)) {
                return;
            }

            $options = array_map(function ($option) {
                if (isset($option['points']) || ! is_array($option)) {
                    return $option;
                }

                $sentences = preg_split('/(?<=[.!?])\s+(?=[A-Z])/u', trim((string) ($option['description'] ?? '')), -1, PREG_SPLIT_NO_EMPTY) ?: [];
                $option['points'] = array_values(array_filter(array_map(fn ($s) => trim($s), $sentences)));

                return $option;
            }, $options);

            DB::table('mou_templates')->where('id', $template->id)->update(['distribution_options' => json_encode($options)]);
        });
    }

    public function down(): void
    {
        Schema::table('book_chapter_settings', function (Blueprint $table) {
            $table->dropColumn(['min_book_cost_print', 'min_book_cost_electronic', 'min_book_cost_both']);
        });

        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn('isbn_type');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('isbn_type');
        });

        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn('isbn_prices');
        });
    }
};
