<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * MOU distribusi buku: template per kategori paket (biasa / Book Chapter),
 * satu MOU per judul buku dengan salinan isinya (perubahan template berlaku
 * maju), penanda tangan per penulis (royalti masing-masing, waktu tanda
 * tangan), PDF bermeterai dan adendum. Penjualan luar diberi jenis
 * (buku fisik / ebook) untuk royalti per jenis.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mou_templates', function (Blueprint $table) {
            $table->id();
            $table->string('category', 20)->unique();
            $table->string('title');
            $table->text('opening');
            $table->json('distribution_options');
            $table->string('distribution_mode', 10)->default('all');
            $table->decimal('physical_royalty', 6, 2)->default(0);
            $table->decimal('ebook_royalty', 6, 2)->default(0);
            $table->json('first_party_terms');
            $table->json('second_party_terms');
            $table->json('closing_terms');
            $table->text('contact_note')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('mous', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);
            $table->foreignId('manuscript_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('book_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('number', 60);
            $table->string('title');
            $table->json('content');
            $table->json('distribution_choice')->nullable();
            $table->boolean('customized')->default(false);
            $table->string('status', 20)->default('pending');
            $table->timestamp('signed_at')->nullable();
            $table->string('final_pdf_path')->nullable();
            $table->string('final_pdf_name')->nullable();
            $table->timestamp('final_uploaded_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });

        Schema::create('mou_signatories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mou_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(1);
            $table->decimal('royalty_physical', 8, 4)->nullable();
            $table->decimal('royalty_ebook', 8, 4)->nullable();
            $table->unsignedSmallInteger('chapters')->nullable();
            $table->json('identity')->nullable();
            $table->timestamp('agreed_at')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->string('signature_path')->nullable();
            $table->timestamps();

            $table->unique(['mou_id', 'user_id']);
        });

        Schema::create('mou_addenda', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mou_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('note')->nullable();
            $table->string('file_path');
            $table->string('file_name');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('book_external_sales', function (Blueprint $table) {
            $table->string('format', 10)->default('physical')->after('marketplace_name');
        });
    }

    public function down(): void
    {
        Schema::table('book_external_sales', function (Blueprint $table) {
            $table->dropColumn('format');
        });

        Schema::dropIfExists('mou_addenda');
        Schema::dropIfExists('mou_signatories');
        Schema::dropIfExists('mous');
        Schema::dropIfExists('mou_templates');
    }
};
