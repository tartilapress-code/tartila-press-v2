<?php

namespace App\Http\Controllers\Api\V1\Book;

use App\Http\Controllers\Controller;
use App\Models\Book;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookReviewController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Store/Upsert - User memberi atau mengubah review sendiri
    |--------------------------------------------------------------------------
    */

    public function store(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $review = $book->reviews()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Review berhasil disimpan.',
            'data' => $review->load('user'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - User menghapus review sendiri
    |--------------------------------------------------------------------------
    */

    public function destroy(Request $request, Book $book): JsonResponse
    {
        $book->reviews()
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Review berhasil dihapus.',
        ]);
    }
}
