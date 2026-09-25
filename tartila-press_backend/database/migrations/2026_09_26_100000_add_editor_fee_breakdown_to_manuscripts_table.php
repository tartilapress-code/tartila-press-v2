<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manuscripts', function (Blueprint $table) {
            // Cara editor mendapatkan naskah ini:
            // admin | pool | author (dipilih langsung penulis) | project_owner.
            $table->string('editor_source')->nullable()->after('editor_id');

            // Fee yang diminta editor (salinan order.editor_fee), hanya terisi
            // bila dipilih langsung penulis. editor_fee tetap TOTAL fee editor
            // (= fee permintaan editor + fee dari admin).
            $table->decimal('editor_requested_fee', 12, 2)->nullable()->after('editor_fee');
        });

        $this->backfillExistingManuscripts();
    }

    public function down(): void
    {
        Schema::table('manuscripts', function (Blueprint $table) {
            $table->dropColumn(['editor_source', 'editor_requested_fee']);
        });
    }

    /**
     * Naskah lama yang sudah punya editor: sumbernya bisa ditebak dari order
     * (editor dipilih penulis) atau proyek Book Chapter (pemilik proyek).
     * Yang ditunjuk admin vs diambil dari pool tidak pernah dicatat, jadi
     * dibiarkan kosong. Sebelum ada fee dari admin, editor_fee naskah yang
     * dipilih penulis sama dengan fee permintaan editor.
     */
    private function backfillExistingManuscripts(): void
    {
        $authorChosen = DB::table('manuscripts')
            ->join('orders', 'orders.id', '=', 'manuscripts.order_id')
            ->whereNotNull('manuscripts.editor_id')
            ->whereColumn('orders.editor_id', 'manuscripts.editor_id')
            ->get(['manuscripts.id', 'orders.editor_fee']);

        foreach ($authorChosen as $row) {
            DB::table('manuscripts')->where('id', $row->id)->update([
                'editor_source' => 'author',
                'editor_requested_fee' => $row->editor_fee,
            ]);
        }

        $projectOwned = DB::table('manuscripts')
            ->join('book_chapters', 'book_chapters.order_id', '=', 'manuscripts.order_id')
            ->join('books', 'books.id', '=', 'book_chapters.book_id')
            ->whereNull('manuscripts.editor_source')
            ->whereNotNull('manuscripts.editor_id')
            ->whereColumn('books.owner_editor_id', 'manuscripts.editor_id')
            ->pluck('manuscripts.id');

        foreach ($projectOwned as $id) {
            DB::table('manuscripts')->where('id', $id)->update([
                'editor_source' => 'project_owner',
            ]);
        }
    }
};
