<?php

namespace App\Http\Controllers\Api\V1\User;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSearchController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Search - Cari akun terdaftar untuk ditambahkan sebagai co-author naskah
    |--------------------------------------------------------------------------
    */

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        $users = User::query()
            ->where('id', '!=', $request->user()->id)
            ->where('name', 'like', '%'.$validated['q'].'%')
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name']);

        return response()->json([
            'success' => true,
            'message' => 'Hasil pencarian pengguna berhasil diambil.',
            'data' => $users,
        ]);
    }
}
