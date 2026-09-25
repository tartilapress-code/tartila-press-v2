<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pub_manuscript_metadata', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('manuscript_id')->unique()->constrained('pub_manuscripts')->cascadeOnDelete();

            $table->string('author')->nullable();
            $table->string('editor')->nullable();
            $table->string('designer')->nullable();
            $table->text('foreword')->nullable();

            // Field identitas tambahan yang bisa didefinisikan bebas oleh
            // template di fitur Layout (mis. "penerjemah", "ilustrator", dst)
            $table->jsonb('custom_fields')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pub_manuscript_metadata');
    }
};
