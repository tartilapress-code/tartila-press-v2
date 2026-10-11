<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\WalletWithdrawal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WithdrawalController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Semua permintaan tarik saldo
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?status=pending|paid|rejected (kosong = semua).
        $query = WalletWithdrawal::with('user:id,name,email')->latest()->orderByDesc('id')
            ->when(
                in_array($request->query('status'), ['pending', 'paid', 'rejected'], true),
                fn ($q) => $q->where('status', $request->query('status'))
            );

        return $this->pageResponse($query->paginate($this->perPage($request, 20)), 'Daftar penarikan berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Pay / Reject - Admin menandai sudah ditransfer, atau menolak (dana
    | kembali ke saldo karena penarikan ditolak tidak dihitung lagi)
    |--------------------------------------------------------------------------
    */

    public function pay(Request $request, WalletWithdrawal $withdrawal): JsonResponse
    {
        return $this->process($request, $withdrawal, 'paid', 'Penarikan ditandai sudah dibayar.');
    }

    public function reject(Request $request, WalletWithdrawal $withdrawal): JsonResponse
    {
        return $this->process($request, $withdrawal, 'rejected', 'Penarikan ditolak, dana kembali ke saldo.');
    }

    private function process(Request $request, WalletWithdrawal $withdrawal, string $status, string $message): JsonResponse
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
            // Rekening sumber transfer (untuk saldo per rekening).
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')],
        ]);

        // Baris dikunci: dua klik/admin bersamaan tidak bisa memproses
        // penarikan yang sama dua kali (mis. dibayar sekaligus ditolak).
        $withdrawal = DB::transaction(function () use ($request, $withdrawal, $status, $validated) {
            $locked = WalletWithdrawal::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            abort_unless($locked->status === 'pending', 422, 'Penarikan ini sudah diproses.');

            $locked->update([
                'status' => $status,
                'admin_note' => $validated['admin_note'] ?? null,
                'processed_by' => $request->user()->id,
                'processed_at' => now(),
                'payment_method_id' => $status === 'paid' ? ($validated['payment_method_id'] ?? null) : null,
            ]);

            return $locked;
        });

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $withdrawal->load('user:id,name,email'),
        ]);
    }
}
