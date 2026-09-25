<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->text('about')->nullable()->after('description');
            $table->json('facilities')->nullable()->after('about');
            $table->json('services')->nullable()->after('facilities');
            $table->date('estimated_publish_date')->nullable()->after('citation_publication_date');
            $table->timestamp('submission_deadline')->nullable()->after('estimated_publish_date');
            $table->foreignId('owner_editor_id')->nullable()->after('created_by')
                ->constrained('users')->nullOnDelete();
            $table->boolean('is_editor_created')->default(false)->after('is_chapter_compilation');
            $table->boolean('is_chapter_offering')->default(false)->after('is_editor_created');

            $table->index(['is_chapter_offering', 'is_editor_created']);
        });
    }

    public function down(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->dropIndex(['is_chapter_offering', 'is_editor_created']);
            $table->dropConstrainedForeignId('owner_editor_id');
            $table->dropColumn([
                'about',
                'facilities',
                'services',
                'estimated_publish_date',
                'submission_deadline',
                'is_editor_created',
                'is_chapter_offering',
            ]);
        });
    }
};
