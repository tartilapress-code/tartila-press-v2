<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_proof_file')->nullable()->after('notes');
            $table->timestamp('payment_proof_uploaded_at')->nullable()->after('payment_proof_file');
            $table->text('payment_verification_note')->nullable()->after('payment_proof_uploaded_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_proof_file', 'payment_proof_uploaded_at', 'payment_verification_note']);
        });
    }
};
