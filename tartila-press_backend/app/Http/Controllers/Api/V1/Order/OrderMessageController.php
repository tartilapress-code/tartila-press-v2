<?php

namespace App\Http\Controllers\Api\V1\Order;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderMessageController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Riwayat pesan pada satu pesanan (pemilik atau admin)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request, Order $order): JsonResponse
    {
        $this->ensureCanAccess($request, $order);

        return response()->json([
            'success' => true,
            'message' => 'Pesan berhasil diambil.',
            'data' => $order->messages()->with('user')->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Kirim pesan baru pada pesanan (pemilik atau admin)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request, Order $order): JsonResponse
    {
        $this->ensureCanAccess($request, $order);

        abort_if(
            $order->status === 'completed',
            422,
            'Pesanan ini sudah selesai, tidak bisa mengirim pesan baru.'
        );

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $isAdmin = $request->user()->roles()->where('name', 'admin')->exists();

        $message = $order->messages()->create([
            'user_id' => $request->user()->id,
            'is_admin' => $isAdmin,
            'body' => $validated['body'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pesan berhasil dikirim.',
            'data' => $message->load('user'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function ensureCanAccess(Request $request, Order $order): void
    {
        $user = $request->user();
        $isOwner = $order->user_id === $user->id;
        $isAdmin = $user->roles()->where('name', 'admin')->exists();

        abort_unless(
            $isOwner || $isAdmin,
            403,
            'Anda tidak berwenang mengakses pesanan ini.'
        );
    }
}
