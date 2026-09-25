<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Throwable;

class EmailVerificationController extends Controller
{
    use RespondsWithFrontendResult;

    public function send(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'message' => 'Email sudah terverifikasi.',
            ], 400);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Email verifikasi gagal dikirim. Silakan coba lagi beberapa saat lagi.',
            ], 503);
        }

        return response()->json([
            'success' => true,
            'message' => 'Email verifikasi berhasil dikirim.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Verify - link dari email
    |--------------------------------------------------------------------------
    |
    | Link ini dibuka langsung dari inbox (browser), jadi hasilnya dialihkan
    | ke halaman frontend. Klien API (Accept: application/json) tetap
    | menerima JSON. Tidak butuh login: signature + hash sudah membuktikan
    | pemilik link.
    |
    */

    public function verify(
        Request $request,
        int $id,
        string $hash
    ): JsonResponse|RedirectResponse {
        if (! $request->hasValidSignature()) {
            return $this->frontendResult(
                $request,
                'invalid',
                'Link verifikasi tidak valid atau sudah kedaluwarsa.',
                403
            );
        }

        $user = User::find($id);

        if (! $user) {
            return $this->frontendResult(
                $request,
                'invalid',
                'User tidak ditemukan.',
                404
            );
        }

        if (! hash_equals(
            sha1($user->getEmailForVerification()),
            $hash
        )) {
            return $this->frontendResult(
                $request,
                'invalid',
                'Link verifikasi tidak valid.',
                403
            );
        }

        if ($user->hasVerifiedEmail()) {
            return $this->frontendResult(
                $request,
                'already',
                'Email sudah terverifikasi.'
            );
        }

        $user->markEmailAsVerified();

        event(new Verified($user));

        AuditLog::record(
            $user->id,
            'email_verified',
            'success',
            $request
        );

        return $this->frontendResult(
            $request,
            'success',
            'Email berhasil diverifikasi.'
        );
    }
}
