<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Menyukai, menyimpan ke rak, dan berkomentar. */
class InteractionController extends Controller
{
    public function like(Request $request, ReaderBook $readerBook): JsonResponse
    {
        return $this->toggle($request, $readerBook, 'reader_likes', true);
    }

    public function unlike(Request $request, ReaderBook $readerBook): JsonResponse
    {
        return $this->toggle($request, $readerBook, 'reader_likes', false);
    }

    public function save(Request $request, ReaderBook $readerBook): JsonResponse
    {
        return $this->toggle($request, $readerBook, 'reader_saves', true);
    }

    public function unsave(Request $request, ReaderBook $readerBook): JsonResponse
    {
        return $this->toggle($request, $readerBook, 'reader_saves', false);
    }

    public function storeComment(Request $request, ReaderBook $readerBook): JsonResponse
    {
        $this->ensureListed($readerBook);

        $validated = $request->validate(['body' => ['required', 'string', 'min:1', 'max:2000']]);

        $comment = ReaderComment::create([
            'reader_book_id' => $readerBook->id,
            'user_id' => $request->user()->id,
            'body' => trim($validated['body']),
        ]);
        $this->bump($readerBook->id, 'comments_count', 1);

        return response()->json([
            'success' => true,
            'message' => 'Komentar ditambahkan.',
            'data' => [
                'id' => $comment->id,
                'body' => $comment->body,
                'user' => ['id' => $request->user()->id, 'name' => $request->user()->name],
                'created_at' => $comment->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function destroyComment(Request $request, ReaderComment $comment): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $comment->user_id === $user->id || $user->roles()->where('name', 'admin')->exists(),
            403,
            'Anda tidak berwenang menghapus komentar ini.'
        );

        if ($comment->delete()) {
            $this->bump($comment->reader_book_id, 'comments_count', -1);
        }

        return response()->json(['success' => true, 'message' => 'Komentar dihapus.']);
    }

    private function toggle(Request $request, ReaderBook $readerBook, string $table, bool $on): JsonResponse
    {
        $this->ensureListed($readerBook);

        $keys = ['user_id' => $request->user()->id, 'reader_book_id' => $readerBook->id];

        $column = $table === 'reader_likes' ? 'likes_count' : 'saves_count';

        // Penghitung di reader_books hanya berubah kalau barisnya benar-benar bertambah/berkurang.
        $changed = $on
            ? DB::table($table)->insertOrIgnore($keys + ['created_at' => now()])
            : DB::table($table)->where($keys)->delete();

        if ($changed > 0) {
            $this->bump($readerBook->id, $column, $on ? 1 : -1);
        }

        return response()->json([
            'success' => true,
            'message' => 'Tersimpan.',
            'data' => ['active' => $on, 'count' => (int) DB::table('reader_books')->where('id', $readerBook->id)->value($column)],
        ]);
    }

    /** Ubah penghitung denormalisasi (tidak pernah di bawah 0). */
    private function bump(int $readerBookId, string $column, int $by): void
    {
        $query = DB::table('reader_books')->where('id', $readerBookId);

        $by > 0
            ? $query->increment($column, $by)
            : $query->where($column, '>', 0)->decrement($column, -$by);
    }

    private function ensureListed(ReaderBook $readerBook): void
    {
        abort_unless(ReaderBook::listed()->whereKey($readerBook->id)->exists(), 404, 'Buku tidak ditemukan.');
    }
}
