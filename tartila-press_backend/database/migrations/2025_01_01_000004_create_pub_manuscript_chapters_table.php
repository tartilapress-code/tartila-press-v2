<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_manuscript_chapters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('manuscript_id')->constrained('pub_manuscripts')->cascadeOnDelete();

            $table->string('title');
            $table->unsignedInteger('order')->default(0);

            $table->timestamps();

            $table->index(['manuscript_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_manuscript_chapters');
    }
};
