<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();

            $table->string('name');
            $table->string('photo')->nullable();
            $table->string('category')->nullable();

            $table->decimal('price', 12, 2);
            $table->unsignedTinyInteger('discount')->default(0);

            $table->text('description')->nullable();

            $table->json('terms')->nullable();
            $table->json('facilities')->nullable();
            $table->json('services')->nullable();
            $table->json('notes')->nullable();

            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
