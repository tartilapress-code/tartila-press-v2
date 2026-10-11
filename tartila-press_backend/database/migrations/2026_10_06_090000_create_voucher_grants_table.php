<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hak voucher yang diberikan admin kepada penulis/editor: kolam persen
        // (dibagi pembuat voucher jadi diskon pembeli + fee untuk dirinya),
        // batas jumlah voucher dan masa berlaku yang berulang tiap periode.
        Schema::create('voucher_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->json('targets');
            $table->decimal('pool_percent', 5, 2);
            $table->unsignedInteger('max_vouchers');
            $table->unsignedInteger('period_days');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_grants');
    }
};
