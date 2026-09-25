<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_references', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('manuscript_id')->constrained('pub_manuscripts')->cascadeOnDelete();

            $table->text('citation');
            $table->unsignedInteger('order')->default(0);

            $table->timestamps();

            $table->index(['manuscript_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_references');
    }
};
