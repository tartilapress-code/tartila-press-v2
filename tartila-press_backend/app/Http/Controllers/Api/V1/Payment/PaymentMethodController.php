<?php

namespace App\Http\Controllers\Api\V1\Payment;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentMethodController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Index - Daftar rekening aktif untuk instruksi pembayaran
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $methods = PaymentMethod::where('is_active', true)
            ->orderBy('bank_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar metode pembayaran berhasil diambil.',
            'data' => $methods,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Index - Semua metode termasuk yang nonaktif
    |--------------------------------------------------------------------------
    */

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar metode pembayaran berhasil diambil.',
            'data' => PaymentMethod::orderBy('bank_name')->get(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin menambah rekening
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePaymentMethod($request);

        $method = PaymentMethod::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Metode pembayaran berhasil ditambahkan.',
            'data' => $method,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Admin mengubah rekening
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $validated = $this->validatePaymentMethod($request, sometimes: true);

        $paymentMethod->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Metode pembayaran berhasil diperbarui.',
            'data' => $paymentMethod,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Admin menghapus rekening
    |--------------------------------------------------------------------------
    */

    public function destroy(PaymentMethod $paymentMethod): JsonResponse
    {
        $paymentMethod->delete();

        return response()->json([
            'success' => true,
            'message' => 'Metode pembayaran berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Validation Rules
    |--------------------------------------------------------------------------
    */

    private function validatePaymentMethod(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes
            ? ['sometimes', ...$rules]
            : $rules;

        return $request->validate([
            'bank_name' => $rule(['required', 'string', 'max:255']),
            'account_number' => $rule(['required', 'string', 'max:255']),
            'account_holder_name' => $rule(['required', 'string', 'max:255']),
            'is_active' => ['nullable', 'boolean'],
        ]);
    }
}
