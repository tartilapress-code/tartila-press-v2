<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('book_external_sales', function (Blueprint $table) {
            $table->id();

            $table->foreignId('book_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('marketplace_name');
            $table->decimal('original_price', 12, 2);
            $table->unsignedTinyInteger('discount_percentage')->nullable();
            $table->decimal('discounted_price', 12, 2)->nullable();
            $table->unsignedInteger('quantity_sold')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('book_external_sales');
    }
};
