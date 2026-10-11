<?php

use App\Support\PdfPages;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Ebook Tartila Book diambil dari ebook buku di Tartila Press (admin cukup
 * unggah sekali). Jumlah halaman disimpan di buku; kolom berkas milik
 * reader_books dibuang setelah isinya dipindah ke buku.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->unsignedInteger('ebook_pages')->nullable()->after('ebook_uploaded_at');
        });

        // Berkas yang sudah diunggah lewat Tartila Book dipindah ke buku (berkasnya tetap
        // di tempat yang sama). Kalau buku sudah punya ebook sendiri, ebook buku yang dipakai.
        DB::table('reader_books')->whereNotNull('file_path')->orderBy('id')->get()->each(function ($row) {
            $book = DB::table('books')->where('id', $row->book_id)->first();

            if (! $book || filled($book->ebook_file)) {
                return;
            }

            DB::table('books')->where('id', $book->id)->update([
                'ebook_file' => $row->file_path,
                'ebook_name' => $row->file_name,
                'ebook_uploaded_at' => $row->file_updated_at ?? now(),
                'ebook_pages' => $row->page_count ?: null,
            ]);
        });

        // Ebook PDF yang sudah ada di buku: jumlah halamannya dibaca dari berkas (PDF klasik).
        // Yang tidak terbaca diisi ulang saat admin mengunggah ulang dari Tartila Press.
        DB::table('books')->whereNotNull('ebook_file')->where('ebook_file', 'like', '%.pdf')->whereNull('ebook_pages')->orderBy('id')->get()
            ->each(function ($book) {
                $path = Storage::disk('local')->path($book->ebook_file);
                $pages = is_file($path) ? PdfPages::count($path) : null;

                if ($pages) {
                    DB::table('books')->where('id', $book->id)->update(['ebook_pages' => $pages]);
                }
            });

        Schema::table('reader_books', function (Blueprint $table) {
            $table->dropColumn(['file_path', 'file_name', 'file_size', 'page_count', 'file_updated_at']);
        });
    }

    public function down(): void
    {
        Schema::table('reader_books', function (Blueprint $table) {
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedInteger('page_count')->default(0);
            $table->timestamp('file_updated_at')->nullable();
        });

        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn('ebook_pages');
        });
    }
};
