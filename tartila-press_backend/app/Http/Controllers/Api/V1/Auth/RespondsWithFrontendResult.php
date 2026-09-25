<?php

namespace App\Http\Controllers\Api\V1\Auth;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Untuk link yang dibuka langsung dari inbox (verifikasi email, konfirmasi
 * ganti email): browser dialihkan ke halaman hasil di frontend, sedangkan
 * klien API (Accept: application/json) tetap menerima JSON.
 */
trait RespondsWithFrontendResult
{
    protected function frontendResult(
        Request $request,
        string $result,
        string $message,
        int $status = 200
    ): JsonResponse|RedirectResponse {
        if ($request->expectsJson()) {
            return response()->json([
                'success' => $status < 400,
                'message' => $message,
            ], $status);
        }

        return redirect()->away(
            rtrim(config('app.frontend_url'), '/')
            .'/verifikasi-email?status='.$result
        );
    }
}
