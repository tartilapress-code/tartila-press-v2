<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('book_shipments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->string('recipient_name');
            $table->string('recipient_phone', 20);
            $table->text('recipient_address');

            $table->string('status')->default('pending');

            $table->date('estimated_arrival_date')->nullable();
            $table->timestamp('awaiting_confirmation_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->string('delivery_confirmed_by')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('book_shipments');
    }
};
