<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ChangeEmailRequest;
use App\Http\Requests\Api\V1\Auth\ChangePasswordRequest;
use App\Http\Requests\Api\V1\Auth\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Requests\Api\V1\Auth\ResetPasswordRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    use RespondsWithFrontendResult;

    /*
    |--------------------------------------------------------------------------
    | Login Lockout
    |--------------------------------------------------------------------------
    |
    | Maksimal 5 percobaan login gagal berturut-turut per email, dikunci
    | selama 15 menit (900 detik). Limiter kedua per-IP (20/15 menit)
    | ditambahkan sebagai lapisan proteksi terhadap satu penyerang yang
    | mencoba banyak email berbeda dari satu sumber.
    |
    */

    private const LOGIN_MAX_ATTEMPTS_PER_EMAIL = 5;

    private const LOGIN_MAX_ATTEMPTS_PER_IP = 20;

    private const LOGIN_LOCKOUT_SECONDS = 900;

    public function __construct(
        private readonly RateLimiter $limiter
    ) {}

    private function loginEmailKey(string $email): string
    {
        return 'login-email:'.Str::lower($email);
    }

    private function loginIpKey(Request $request): string
    {
        return 'login-ip:'.$request->ip();
    }

    /*
    |--------------------------------------------------------------------------
    | Register
    |--------------------------------------------------------------------------
    */

    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $result = DB::transaction(function () use ($validated) {

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
            ]);

            /*
            |--------------------------------------------------------------------------
            | Default Role
            |--------------------------------------------------------------------------
            |
            | Semua registrasi publik selalu jadi role "user". Naik jadi
            | Penulis/Editor hanya lewat alur request yang disetujui Admin.
            |
            */

            $role = Role::where(
                'name',
                'user'
            )->firstOrFail();

            $user->roles()->attach($role->id);

            $user->personalProfile()->create([
                'education_level' => $validated['education_level'],
                'institution' => $validated['institution'] ?? null,
                'age' => $validated['age'],
                'gender' => $validated['gender'],
                'occupation' => $validated['occupation'],
                'phone' => $validated['phone'],
            ]);

            $token = $user->createToken(
                'auth-token'
            )->plainTextToken;

            return [
                'user' => $user->load([
                    'roles',
                    'personalProfile',
                ]),
                'access_token' => $token,
                'token_type' => 'Bearer',
            ];
        });

        AuditLog::record(
            $result['user']->id,
            'register',
            'success',
            $request
        );

        /*
        |--------------------------------------------------------------------------
        | Email Verifikasi
        |--------------------------------------------------------------------------
        |
        | Akun sudah jadi dan token sudah terbit, jadi kegagalan kirim email
        | (SMTP down, dll.) tidak boleh menggagalkan registrasi. User bisa
        | meminta kirim ulang dari halaman Akun.
        |
        */

        try {
            $result['user']->sendEmailVerificationNotification();
        } catch (Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'message' => 'Registrasi berhasil.',
            'data' => $result,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    public function login(LoginRequest $request): JsonResponse
    {
        $emailKey = $this->loginEmailKey($request->email);
        $ipKey = $this->loginIpKey($request);

        /*
        |--------------------------------------------------------------------------
        | Lockout Check
        |--------------------------------------------------------------------------
        */

        if (
            $this->limiter->tooManyAttempts(
                $emailKey,
                self::LOGIN_MAX_ATTEMPTS_PER_EMAIL
            ) ||
            $this->limiter->tooManyAttempts(
                $ipKey,
                self::LOGIN_MAX_ATTEMPTS_PER_IP
            )
        ) {
            $seconds = $this->limiter->availableIn($emailKey);

            AuditLog::record(
                null,
                'login',
                'locked_out',
                $request,
                ['email' => $request->email]
            );

            return response()->json([
                'success' => false,
                'message' => 'Terlalu banyak percobaan login. Coba lagi dalam '
                    .ceil($seconds / 60).' menit.',
            ], 429);
        }

        $user = User::where(
            'email',
            $request->email
        )
            ->with('roles')
            ->first();

        if (
            ! $user ||
            ! Hash::check(
                $request->password,
                $user->password
            )
        ) {
            $this->limiter->hit($emailKey, self::LOGIN_LOCKOUT_SECONDS);
            $this->limiter->hit($ipKey, self::LOGIN_LOCKOUT_SECONDS);

            AuditLog::record(
                $user?->id,
                'login',
                'failed',
                $request,
                ['email' => $request->email]
            );

            return response()->json([
                'success' => false,
                'message' => 'Email atau password salah.',
            ], 401);
        }

        $this->limiter->clear($emailKey);
        $this->limiter->clear($ipKey);

        $token = $user->createToken(
            'auth-token'
        )->plainTextToken;

        AuditLog::record(
            $user->id,
            'login',
            'success',
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'data' => [
                'user' => new UserResource($user),
                'access_token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Current User
    |--------------------------------------------------------------------------
    */

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Data user berhasil diambil.',
            'data' => [
                'user' => new UserResource(
                    $request->user()->load('roles')
                ),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Logout
    |--------------------------------------------------------------------------
    */

    public function logout(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $request->user()
            ->currentAccessToken()
            ?->delete();

        AuditLog::record(
            $userId,
            'logout',
            'success',
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Change Password
    |--------------------------------------------------------------------------
    */

    public function changePassword(
        ChangePasswordRequest $request
    ): JsonResponse {
        $user = $request->user();

        $user->update([
            'password' => Hash::make(
                $request->password
            ),
        ]);

        /*
        |--------------------------------------------------------------------------
        | Revoke all existing Sanctum tokens
        |--------------------------------------------------------------------------
        |
        | Setelah password berubah, seluruh session/token lama dicabut.
        |
        */

        $user->tokens()->delete();

        AuditLog::record(
            $user->id,
            'password_change',
            'success',
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diubah.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Forgot Password
    |--------------------------------------------------------------------------
    */

    public function forgotPassword(
        ForgotPasswordRequest $request
    ): JsonResponse {
        /*
        |--------------------------------------------------------------------------
        | Jawaban selalu sama
        |--------------------------------------------------------------------------
        |
        | Email tidak terdaftar, atau link sudah dikirim kurang dari 60 detik
        | lalu (throttle broker), dijawab persis seperti sukses — supaya
        | endpoint ini tidak bisa dipakai untuk menebak email yang terdaftar.
        |
        */

        try {
            Password::sendResetLink(
                $request->only('email')
            );
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Email gagal dikirim. Silakan coba lagi beberapa saat lagi.',
            ], 503);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jika email terdaftar, link reset password telah dikirim. Cek kotak masuk dan folder spam.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Reset Password
    |--------------------------------------------------------------------------
    */

    public function resetPassword(
        ResetPasswordRequest $request
    ): JsonResponse {
        $resetUserId = null;

        $status = Password::reset(
            $request->only([
                'email',
                'password',
                'password_confirmation',
                'token',
            ]),
            function ($user, $password) use (&$resetUserId) {

                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => null,
                ])->save();

                /*
                |--------------------------------------------------------------------------
                | Revoke all existing Sanctum tokens
                |--------------------------------------------------------------------------
                */

                $user->tokens()->delete();

                $resetUserId = $user->id;
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            AuditLog::record(
                $resetUserId,
                'password_reset',
                'success',
                $request
            );

            return response()->json([
                'success' => true,
                'message' => 'Password berhasil direset.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Token reset password tidak valid atau telah kedaluwarsa.',
        ], 422);
    }

    /*
    |--------------------------------------------------------------------------
    | Change Email - Request
    |--------------------------------------------------------------------------
    */

    public function changeEmail(
        ChangeEmailRequest $request
    ): JsonResponse {
        $user = $request->user();

        $email = strtolower(
            trim($request->email)
        );

        /*
        |--------------------------------------------------------------------------
        | Generate temporary signed URL
        |--------------------------------------------------------------------------
        |
        | Email baru dimasukkan sebagai query parameter.
        | Signature akan dibuat otomatis oleh Laravel.
        |
        */

        $verificationUrl = URL::temporarySignedRoute(
            'auth.email.change.verify',
            now()->addMinutes(60),
            [
                'id' => $user->id,
                'email' => $email,
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Send confirmation email
        |--------------------------------------------------------------------------
        */

        Mail::raw(
            "Klik link berikut untuk mengubah email akun Anda:\n\n"
            .$verificationUrl
            ."\n\n"
            .'Link berlaku selama 60 menit.',
            function ($message) use ($email) {

                $message
                    ->to($email)
                    ->subject(
                        'Konfirmasi Perubahan Email - Tartila Press'
                    );
            }
        );

        AuditLog::record(
            $user->id,
            'email_change_requested',
            'success',
            $request,
            ['new_email' => $email]
        );

        return response()->json([
            'success' => true,
            'message' => 'Link konfirmasi perubahan email telah dikirim ke email baru.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Change Email - Verify
    |--------------------------------------------------------------------------
    */

    public function verifyChangeEmail(
        Request $request,
        int $id
    ): JsonResponse|RedirectResponse {
        /*
        |--------------------------------------------------------------------------
        | Signature
        |--------------------------------------------------------------------------
        |
        | Divalidasi di sini (bukan middleware "signed") supaya link yang
        | salah/kedaluwarsa tetap dialihkan ke halaman frontend, bukan
        | menampilkan error mentah di browser.
        |
        */

        if (! $request->hasValidSignature()) {
            return $this->frontendResult(
                $request,
                'change-invalid',
                'Link konfirmasi tidak valid atau sudah kedaluwarsa.',
                403
            );
        }

        $user = User::find($id);

        if (! $user) {
            return $this->frontendResult(
                $request,
                'change-invalid',
                'User tidak ditemukan.',
                404
            );
        }

        $email = strtolower(
            trim((string) $request->query('email'))
        );

        /*
        |--------------------------------------------------------------------------
        | Validate Email
        |--------------------------------------------------------------------------
        */

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->frontendResult(
                $request,
                'change-invalid',
                'Format email tidak valid.',
                422
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Link dibuka lagi setelah email sudah diganti
        |--------------------------------------------------------------------------
        |
        | Tidak melakukan apa-apa (token yang terbit sesudah penggantian
        | tidak ikut dicabut).
        |
        */

        if (strtolower($user->email) === $email) {
            return $this->frontendResult(
                $request,
                'changed',
                'Email sudah diubah.'
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Prevent Duplicate Email
        |--------------------------------------------------------------------------
        */

        $emailExists = User::where(
            'email',
            $email
        )
            ->where(
                'id',
                '!=',
                $user->id
            )
            ->exists();

        if ($emailExists) {
            return $this->frontendResult(
                $request,
                'taken',
                'Email sudah digunakan.',
                422
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Update Email
        |--------------------------------------------------------------------------
        |
        | Link konfirmasi ini hanya dikirim ke email baru, jadi klik pada
        | link membuktikan pemilik email baru — langsung ditandai
        | terverifikasi (tidak perlu verifikasi kedua).
        |
        */

        $user->forceFill([
            'email' => $email,
            'email_verified_at' => now(),
        ])->save();

        /*
        |--------------------------------------------------------------------------
        | Revoke Existing Tokens
        |--------------------------------------------------------------------------
        |
        | Karena credential/account identifier berubah,
        | kita cabut token lama.
        |
        */

        $user->tokens()->delete();

        AuditLog::record(
            $user->id,
            'email_change_verified',
            'success',
            $request,
            ['new_email' => $email]
        );

        return $this->frontendResult(
            $request,
            'changed',
            'Email berhasil diubah dan terverifikasi. Silakan login kembali dengan email baru Anda.'
        );
    }
}
