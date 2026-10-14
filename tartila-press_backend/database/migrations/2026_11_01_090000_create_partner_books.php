<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mitra Tartila Book: penerbit mitra mengunggah ebook sendiri (data buku, ebook, hasil turnitin,
 * surat keaslian, MOU) untuk disetujui admin. Buku mitra disimpan sebagai baris `books` yang
 * ditandai partner_id (disaring dari semua query Tartila Press), memakai mesin baca yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('company_name');
            $table->string('phone', 40)->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('books', function (Blueprint $table) {
            $table->foreignId('partner_id')->nullable()->constrained('partners')->nullOnDelete();
            // draft -> submitted -> approved | rejected (mitra memperbaiki lalu mengajukan ulang)
            $table->string('partner_status', 20)->nullable();
            $table->text('partner_note')->nullable();
            $table->timestamp('partner_submitted_at')->nullable();
            $table->timestamp('partner_reviewed_at')->nullable();
            $table->foreignId('partner_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            // {turnitin: {path, name, percent}, originality: {path, name}, mou: {path, name}}
            $table->json('partner_documents')->nullable();
            $table->index('partner_id');
        });

        Schema::create('partner_book_authors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(1);
            $table->unique(['book_id', 'user_id']);
        });

        Schema::create('partner_book_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            // submitted | resubmitted | approved | rejected | reopened
            $table->string('action', 20);
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        Role::firstOrCreate(
            ['name' => 'mitra'],
            ['display_name' => 'Mitra', 'description' => 'Penerbit mitra Tartila Book (unggah ebook sendiri).']
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_book_events');
        Schema::dropIfExists('partner_book_authors');

        Schema::table('books', function (Blueprint $table) {
            $table->dropConstrainedForeignId('partner_reviewed_by');
            $table->dropConstrainedForeignId('partner_id');
            $table->dropColumn(['partner_status', 'partner_note', 'partner_submitted_at', 'partner_reviewed_at', 'partner_documents']);
        });

        Schema::dropIfExists('partners');
        Role::where('name', 'mitra')->delete();
    }
};
