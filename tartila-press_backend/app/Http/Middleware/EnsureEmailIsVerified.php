<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menahan akun yang emailnya belum diverifikasi dari aksi sensitif.
 *
 * Hanya berlaku bila config "app.require_verified_email" (env
 * REQUIRE_VERIFIED_EMAIL) bernilai true; selain itu semua request lolos,
 * jadi middleware ini aman dipasang di route sebelum SMTP dikonfigurasi.
 */
class EnsureEmailIsVerified
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'error_code' => 'UNAUTHENTICATED',
            ], 401);
        }

        if (
            config('app.require_verified_email')
            && ! $user->hasVerifiedEmail()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Email Anda belum diverifikasi. Verifikasi email terlebih dahulu (cek inbox atau kirim ulang link dari halaman Akun).',
                'error_code' => 'EMAIL_NOT_VERIFIED',
            ], 403);
        }

        return $next($request);
    }
}
