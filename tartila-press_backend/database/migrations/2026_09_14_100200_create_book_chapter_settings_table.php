<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('book_chapter_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('min_chapters')->default(2);
            $table->unsignedInteger('max_chapters')->nullable();
            $table->decimal('min_price', 12, 2)->default(0);
            $table->unsignedTinyInteger('max_discount')->default(100);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('book_chapter_settings');
    }
};
