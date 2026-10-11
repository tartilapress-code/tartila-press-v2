<?php

namespace App\Http\Controllers\Api\V1\Wallet;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WalletWithdrawal;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WalletController extends Controller
{
    public function __construct(private readonly WalletService $wallet) {}

    /*
    |--------------------------------------------------------------------------
    | Show - Dompet Saya: saldo, rincian pemasukan, riwayat penarikan
    |--------------------------------------------------------------------------
    */

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $entries = $this->wallet->entries($user);

        return response()->json([
            'success' => true,
            'message' => 'Dompet berhasil diambil.',
            'data' => [
                'summary' => $this->wallet->summary($user, $entries),
                'entries' => $entries->map(fn (array $entry) => [
                    ...$entry,
                    'amount' => round($entry['amount'], 2),
                    'date' => $entry['date']?->toIso8601String(),
                ])->values(),
                'withdrawals' => WalletWithdrawal::where('user_id', $user->id)->latest()->get(),
                'config' => [
                    'admin_fee' => WalletWithdrawal::ADMIN_FEE,
                    'min_amount' => WalletWithdrawal::MIN_AMOUNT,
                ],
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Withdraw - Minta tarik saldo (biaya admin dipotong dari jumlah)
    |--------------------------------------------------------------------------
    */

    public function withdraw(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:'.WalletWithdrawal::MIN_AMOUNT, 'max:'.self::MAX_MONEY_AMOUNT],
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'regex:/^[0-9]{5,30}$/'],
            'account_name' => ['required', 'string', 'max:150'],
        ], [
            'amount.min' => 'Penarikan minimal Rp '.number_format(WalletWithdrawal::MIN_AMOUNT, 0, ',', '.').'.',
            'account_number.regex' => 'Nomor rekening hanya berisi angka (5–30 digit).',
        ]);

        $amount = round((float) $validated['amount'], 2);

        $withdrawal = DB::transaction(function () use ($request, $validated, $amount) {
            // Kunci baris user supaya dua permintaan bersamaan tidak
            // melewati saldo.
            $user = User::whereKey($request->user()->id)->lockForUpdate()->first();

            $balance = $this->wallet->summary($user)['balance'];

            abort_if($amount > $balance + 0.001, 422, 'Saldo tidak cukup untuk penarikan ini.');

            return WalletWithdrawal::create([
                'user_id' => $user->id,
                'amount' => $amount,
                'admin_fee' => WalletWithdrawal::ADMIN_FEE,
                'net_amount' => $amount - WalletWithdrawal::ADMIN_FEE,
                'bank_name' => $validated['bank_name'],
                'account_number' => $validated['account_number'],
                'account_name' => $validated['account_name'],
                'status' => 'pending',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Permintaan tarik saldo dikirim. Admin akan memprosesnya.',
            'data' => $withdrawal,
        ], 201);
    }
}
