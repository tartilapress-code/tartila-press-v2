<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manuscript_authors', function (Blueprint $table) {
            $table->id();

            $table->foreignId('manuscript_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->unsignedInteger('position');
            $table->timestamp('approved_at')->nullable();

            $table->timestamps();

            $table->unique(['manuscript_id', 'user_id']);
            $table->unique(['manuscript_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manuscript_authors');
    }
};
