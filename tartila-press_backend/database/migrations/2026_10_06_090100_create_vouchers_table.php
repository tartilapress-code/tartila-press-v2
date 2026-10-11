<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Semua kode voucher: dibuat admin (ditanggung perusahaan), dibuat
        // penulis/editor dari hak voucher admin (diskon + fee), atau dibuat
        // penulis/editor dari royalti bukunya sendiri.
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('source', 20);
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('grant_id')->nullable()->constrained('voucher_grants')->nullOnDelete();
            $table->string('name')->nullable();
            $table->json('targets');
            $table->decimal('discount_percent', 5, 2);
            $table->decimal('fee_percent', 5, 2)->default(0);
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('cycle')->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->dateTime('reset_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['source', 'user_id']);
            $table->index('grant_id');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('voucher_id')->nullable()->constrained()->nullOnDelete();
            $table->string('voucher_code')->nullable();
            $table->decimal('voucher_discount', 14, 2)->default(0);
            $table->decimal('voucher_fee', 14, 2)->default(0);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('voucher_discount', 14, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['discount', 'voucher_discount']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['voucher_id']);
            $table->dropColumn(['voucher_id', 'voucher_code', 'voucher_discount', 'voucher_fee']);
        });

        Schema::dropIfExists('vouchers');
    }
};
