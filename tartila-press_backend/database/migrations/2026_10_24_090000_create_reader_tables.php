<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tartila Book (situs baca buku): katalog ebook dari buku yang sudah
 * terbit, taksonomi, akses (gratis/langganan/beli), interaksi pembaca,
 * hitungan baca per halaman dan pengaturan royalti baca.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reader_terms', function (Blueprint $table) {
            $table->id();
            // education_field (non fiksi), category (kategori buku), genre (fiksi)
            $table->string('type', 20);
            $table->string('name', 120);
            // Kategori buku: berlaku untuk fiksi / non_fiksi (null = keduanya).
            $table->string('pustaka', 10)->nullable();
            $table->timestamps();

            $table->unique(['type', 'name']);
        });

        Schema::create('reader_books', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('is_published')->default(false);
            $table->string('pustaka', 10)->default('non_fiksi');
            $table->foreignId('education_field_id')->nullable()->constrained('reader_terms')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('reader_terms')->nullOnDelete();
            $table->foreignId('genre_id')->nullable()->constrained('reader_terms')->nullOnDelete();
            $table->string('age_limit', 5)->default('all');
            $table->string('language', 5)->default('id');

            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedInteger('page_count')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('file_updated_at')->nullable();

            // Beli satuan: harga (null = tidak dijual satuan) + lama akses (null = selamanya).
            $table->decimal('price', 12, 2)->nullable();
            $table->unsignedInteger('access_days')->nullable();

            // Royalti baca khusus buku ini (null = ikut pengaturan umum).
            $table->decimal('purchase_royalty_percent', 5, 2)->nullable();
            $table->decimal('read_fee', 12, 2)->nullable();

            // Hitungan baca (disimpan agar katalog cepat).
            $table->unsignedBigInteger('read_events')->default(0);
            $table->unsignedInteger('top_page_readers')->default(0);

            $table->timestamps();

            $table->index(['is_published', 'pustaka']);
        });

        Schema::create('reader_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('period', 10); // daily|weekly|monthly|yearly
            $table->decimal('price', 12, 2);
            $table->string('description', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reader_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 40)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10); // book|plan
            $table->foreignId('reader_book_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reader_plan_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->decimal('amount', 12, 2);
            $table->string('status', 12)->default('pending'); // pending|confirmed|cancelled
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('payment_proof_file')->nullable();
            $table->timestamp('payment_proof_uploaded_at')->nullable();
            $table->timestamp('payment_due_at')->nullable();
            $table->text('payment_verification_note')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'confirmed_at']);
            $table->index(['reader_book_id', 'status']);
        });

        Schema::create('reader_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10); // book|plan
            $table->foreignId('reader_book_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('reader_plan_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reader_order_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'kind', 'ends_at']);
        });

        Schema::create('reader_access_rules', function (Blueprint $table) {
            $table->id();
            // null = semua buku
            $table->foreignId('reader_book_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('action', 5); // open (baca gratis) | lock
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->index(['reader_book_id', 'starts_at']);
        });

        Schema::create('reader_likes', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['user_id', 'reader_book_id']);
        });

        Schema::create('reader_saves', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['user_id', 'reader_book_id']);
        });

        Schema::create('reader_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['reader_book_id', 'id']);
        });

        Schema::create('reader_bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'reader_book_id', 'page']);
        });

        Schema::create('reader_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('last_page')->default(1);
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'reader_book_id']);
        });

        // Satu baris = satu pembaca membuka satu halaman pada satu hari
        // (tanggal WIB). Hari yang sama tetap dihitung 1; hari lain +1.
        Schema::create('reader_page_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->date('read_date');
            // false untuk penulis buku itu sendiri (tidak dihitung ke royalti/publik).
            $table->boolean('counted')->default(true);
            $table->timestamp('created_at')->nullable();

            $table->unique(['reader_book_id', 'user_id', 'page', 'read_date'], 'reader_page_reads_unique');
            $table->index(['reader_book_id', 'read_date']);
        });

        // Ringkasan per halaman: pembaca berbeda & total bacaan (user-hari).
        Schema::create('reader_page_stats', function (Blueprint $table) {
            $table->foreignId('reader_book_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->unsignedInteger('readers')->default(0);
            $table->unsignedBigInteger('events')->default(0);

            $table->primary(['reader_book_id', 'page']);
        });

        Schema::create('reader_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('purchase_royalty_percent', 5, 2)->default(20);
            $table->decimal('read_fee', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'reader_settings', 'reader_page_stats', 'reader_page_reads', 'reader_progress',
            'reader_bookmarks', 'reader_comments', 'reader_saves', 'reader_likes',
            'reader_access_rules', 'reader_entitlements', 'reader_orders', 'reader_plans',
            'reader_books', 'reader_terms',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
