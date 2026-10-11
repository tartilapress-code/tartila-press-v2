<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Saldo awal tiap rekening (sebelum transaksi yang tercatat di sistem).
        Schema::table('payment_methods', function (Blueprint $table) {
            $table->decimal('opening_balance', 15, 2)->default(0);
        });

        // Rekening yang menerima pembayaran pesanan / mengirim penarikan saldo.
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
        });

        Schema::table('wallet_withdrawals', function (Blueprint $table) {
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
        });

        // Eksemplar buku gratis yang diberikan paket / item (biaya cetak 3 + N).
        Schema::table('packages', function (Blueprint $table) {
            $table->unsignedInteger('free_copies')->default(0);
        });

        Schema::table('custom_package_items', function (Blueprint $table) {
            $table->unsignedInteger('free_copies')->default(0);
        });

        Schema::create('finance_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('admin_cover_cost', 15, 2)->default(50000);
            $table->decimal('print_cost_percent', 5, 2)->default(20);
            $table->unsignedInteger('base_print_copies')->default(3);
            // Harga jual buku perkiraan bila bukunya belum terbit/berharga.
            $table->decimal('default_book_price', 15, 2)->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('finance_settings')->insert(['created_at' => now(), 'updated_at' => now()]);

        // Isian admin per pesanan paket, proyek Book Chapter (book) atau event.
        Schema::create('finance_details', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 20);
            $table->unsignedBigInteger('subject_id');
            $table->decimal('book_price', 15, 2)->nullable();
            $table->unsignedInteger('extra_copies')->nullable();
            $table->boolean('includes_hki')->nullable();
            $table->decimal('admin_cover_cost', 15, 2)->nullable();
            $table->decimal('speaker_fee', 15, 2)->nullable();
            $table->decimal('other_costs', 15, 2)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['subject_type', 'subject_id']);
        });

        // Transaksi yang dicatat manual (biaya operasional, cetak, honor, ...).
        Schema::create('finance_transactions', function (Blueprint $table) {
            $table->id();
            $table->date('transaction_date');
            $table->string('direction', 3);
            $table->string('category', 40);
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('status', 20)->default('completed');
            $table->string('description', 500);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('transaction_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_transactions');
        Schema::dropIfExists('finance_details');
        Schema::dropIfExists('finance_settings');

        Schema::table('custom_package_items', fn (Blueprint $table) => $table->dropColumn('free_copies'));
        Schema::table('packages', fn (Blueprint $table) => $table->dropColumn('free_copies'));
        Schema::table('wallet_withdrawals', fn (Blueprint $table) => $table->dropConstrainedForeignId('payment_method_id'));
        Schema::table('orders', fn (Blueprint $table) => $table->dropConstrainedForeignId('payment_method_id'));
        Schema::table('payment_methods', fn (Blueprint $table) => $table->dropColumn('opening_balance'));
    }
};
