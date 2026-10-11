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

        $comment->delete();

        return response()->json(['success' => true, 'message' => 'Komentar dihapus.']);
    }

    private function toggle(Request $request, ReaderBook $readerBook, string $table, bool $on): JsonResponse
    {
        $this->ensureListed($readerBook);

        $keys = ['user_id' => $request->user()->id, 'reader_book_id' => $readerBook->id];

        if ($on) {
            DB::table($table)->insertOrIgnore($keys + ['created_at' => now()]);
        } else {
            DB::table($table)->where($keys)->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Tersimpan.',
            'data' => ['active' => $on, 'count' => DB::table($table)->where('reader_book_id', $readerBook->id)->count()],
        ]);
    }

    private function ensureListed(ReaderBook $readerBook): void
    {
        abort_unless(ReaderBook::listed()->whereKey($readerBook->id)->exists(), 404, 'Buku tidak ditemukan.');
    }
}
