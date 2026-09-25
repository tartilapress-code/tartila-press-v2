<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manuscripts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('title');
            $table->json('authors');

            $table->string('status')->default('submitted');

            $table->foreignId('editor_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->decimal('editor_fee', 12, 2)->nullable();
            $table->date('editor_deadline')->nullable();
            $table->text('editor_assignment_note')->nullable();
            $table->boolean('open_for_claim')->default(false);

            $table->string('author_bio_photo')->nullable();
            $table->string('author_bio_name')->nullable();
            $table->text('author_bio_text')->nullable();

            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manuscripts');
    }
};
