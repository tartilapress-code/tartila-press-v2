<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $resetUrl = function ($notifiable, string $token) {

            $frontendUrl = rtrim(config('app.frontend_url'), '/');

            return $frontendUrl
                .'/reset-password?token='.urlencode($token)
                .'&email='.urlencode($notifiable->getEmailForPasswordReset());
        };

        ResetPassword::createUrlUsing($resetUrl);

        /*
        |--------------------------------------------------------------------------
        | Email Reset Password (Bahasa Indonesia)
        |--------------------------------------------------------------------------
        */

        ResetPassword::toMailUsing(function ($notifiable, string $token) use ($resetUrl) {
            return (new MailMessage)
                ->subject('Reset Password - Tartila Press')
                ->markdown('emails.reset-password', [
                    'name' => $notifiable->name,
                    'url' => $resetUrl($notifiable, $token),
                    'expireMinutes' => config(
                        'auth.passwords.'.config('auth.defaults.passwords').'.expire',
                        60
                    ),
                ]);
        });

        /*
        |--------------------------------------------------------------------------
        | Email Verifikasi (Bahasa Indonesia)
        |--------------------------------------------------------------------------
        |
        | URL verifikasi tetap bawaan Laravel (signed route ke API, yang lalu
        | mengalihkan browser ke halaman frontend).
        |
        */

        VerifyEmail::toMailUsing(function ($notifiable, string $url) {
            return (new MailMessage)
                ->subject('Verifikasi Email - Tartila Press')
                ->markdown('emails.verify-email', [
                    'name' => $notifiable->name,
                    'url' => $url,
                    'expireMinutes' => config('auth.verification.expire', 60),
                ]);
        });

        /*
        |--------------------------------------------------------------------------
        | Password Policy
        |--------------------------------------------------------------------------
        |
        | Berlaku untuk seluruh validasi yang memakai Password::defaults()
        | (register, change password, reset password).
        |
        */

        Password::defaults(function () {
            return Password::min(8)
                ->mixedCase()
                ->numbers()
                ->symbols();
        });
    }
}
