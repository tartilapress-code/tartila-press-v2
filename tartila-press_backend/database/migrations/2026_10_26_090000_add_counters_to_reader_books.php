<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jumlah suka/simpan/komentar disimpan di reader_books (dihitung ulang sekali di sini lalu
 * dijaga saat ada perubahan). Sebelumnya dihitung dengan subquery COUNT pada tabel jutaan baris
 * di setiap tampilan katalog/detail/rak: 80-200 ms per request dan 12 detik saat diurutkan
 * menurut suka (uji beban, Lampiran H SRS).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reader_books', function (Blueprint $table) {
            $table->unsignedInteger('likes_count')->default(0)->after('top_page_readers');
            $table->unsignedInteger('saves_count')->default(0)->after('likes_count');
            $table->unsignedInteger('comments_count')->default(0)->after('saves_count');
        });

        DB::statement('UPDATE reader_books SET likes_count = (SELECT COUNT(*) FROM reader_likes WHERE reader_likes.reader_book_id = reader_books.id)');
        DB::statement('UPDATE reader_books SET saves_count = (SELECT COUNT(*) FROM reader_saves WHERE reader_saves.reader_book_id = reader_books.id)');
        DB::statement('UPDATE reader_books SET comments_count = (SELECT COUNT(*) FROM reader_comments WHERE reader_comments.reader_book_id = reader_books.id)');
    }

    public function down(): void
    {
        Schema::table('reader_books', function (Blueprint $table) {
            $table->dropColumn(['likes_count', 'saves_count', 'comments_count']);
        });
    }
};
