<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('book_chapters', function (Blueprint $table) {
            $table->foreignId('order_id')->nullable()->unique()->after('manuscript_id')
                ->constrained()->nullOnDelete();
            $table->decimal('price', 12, 2)->nullable()->after('title');
            $table->unsignedTinyInteger('discount')->nullable()->after('price');
            $table->text('sop_terms')->nullable()->after('discount');
        });

        // manuscript_id must become nullable, but doctrine/dbal isn't installed so
        // ->nullable()->change() isn't available. Rebuild the column instead —
        // this works identically on SQLite (tests) and Postgres (dev/prod).
        $existing = DB::table('book_chapters')->pluck('manuscript_id', 'id');

        Schema::table('book_chapters', function (Blueprint $table) {
            $table->dropUnique(['manuscript_id']);
            $table->dropConstrainedForeignId('manuscript_id');
        });

        Schema::table('book_chapters', function (Blueprint $table) {
            $table->foreignId('manuscript_id')->nullable()->unique()->after('book_id')
                ->constrained()->nullOnDelete();
        });

        foreach ($existing as $id => $manuscriptId) {
            DB::table('book_chapters')->where('id', $id)->update(['manuscript_id' => $manuscriptId]);
        }
    }

    public function down(): void
    {
        $existing = DB::table('book_chapters')->pluck('manuscript_id', 'id');

        Schema::table('book_chapters', function (Blueprint $table) {
            $table->dropUnique(['manuscript_id']);
            $table->dropConstrainedForeignId('manuscript_id');
        });

        Schema::table('book_chapters', function (Blueprint $table) {
            $table->foreignId('manuscript_id')->after('book_id')
                ->constrained()->cascadeOnDelete();
        });

        foreach ($existing as $id => $manuscriptId) {
            if ($manuscriptId !== null) {
                DB::table('book_chapters')->where('id', $id)->update(['manuscript_id' => $manuscriptId]);
            }
        }

        Schema::table('book_chapters', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_id');
            $table->dropColumn(['price', 'discount', 'sop_terms']);
        });
    }
};
