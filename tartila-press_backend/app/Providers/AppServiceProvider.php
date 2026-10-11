<?php

namespace App\Providers;

use App\Models\Article;
use App\Models\Certificate;
use App\Models\EventRegistration;
use App\Models\IsbnApplication;
use App\Models\Manuscript;
use App\Models\OrderMessage;
use App\Models\OrderStatusHistory;
use App\Models\RoleRequest;
use App\Models\VoucherGrant;
use App\Models\WalletWithdrawal;
use App\Observers\IsbnApplicationObserver;
use App\Observers\ManuscriptObserver;
use App\Observers\OrderMessageObserver;
use App\Observers\OrderStatusHistoryObserver;
use App\Observers\SimpleNoticeObserver;
use App\Observers\WalletWithdrawalObserver;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Validator;
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
        // Relasi yang diakses pada satu model dalam koleksi langsung dimuat untuk
        // seluruh koleksi (satu query), mencegah query N+1 — mis. atribut
        // editor_name pada daftar buku atau harga bab pada daftar Book Chapter.
        Model::automaticallyEagerLoadRelationships();

        $this->registerHttpUrlRule();
        $this->registerNotificationObservers();

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

    /*
    |--------------------------------------------------------------------------
    | Aturan "http_url" - tautan yang diisi pengguna (sampul, foto, link event)
    |--------------------------------------------------------------------------
    |
    | Hanya tautan http:// atau https:// yang utuh; menolak "javascript:",
    | "file://", jalur lokal, dan teks bebas yang bisa dipakai menyerang
    | browser atau server (pengambilan gambar).
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Notifikasi (lonceng + tanda merah + email) dari perubahan data
    |--------------------------------------------------------------------------
    */

    private function registerNotificationObservers(): void
    {
        OrderStatusHistory::observe(OrderStatusHistoryObserver::class);
        OrderMessage::observe(OrderMessageObserver::class);
        Manuscript::observe(ManuscriptObserver::class);
        WalletWithdrawal::observe(WalletWithdrawalObserver::class);
        IsbnApplication::observe(IsbnApplicationObserver::class);

        foreach ([Certificate::class, VoucherGrant::class, Article::class, RoleRequest::class, EventRegistration::class] as $model) {
            $model::observe(SimpleNoticeObserver::class);
        }
    }

    private const HTTP_URL_LABELS = [
        'front_cover' => 'sampul depan',
        'back_cover' => 'sampul belakang',
        'banner' => 'banner',
        'meet_link' => 'link meeting',
        'youtube_url' => 'link YouTube',
        'certificate_url' => 'link sertifikat',
        'author_bio_photo' => 'foto biodata',
        'profile_photo' => 'foto profil',
        'image_url' => 'foto legalitas',
        'photo_url' => 'foto anggota tim',
        'social_links.instagram' => 'tautan Instagram',
        'social_links.facebook' => 'tautan Facebook',
        'social_links.tiktok' => 'tautan TikTok',
        'social_links.youtube' => 'tautan YouTube',
        'social_links.x' => 'tautan X',
        'social_links.linkedin' => 'tautan LinkedIn',
        'social_links.website' => 'tautan website',
    ];

    private function registerHttpUrlRule(): void
    {
        Validator::extend('http_url', fn ($attribute, $value) => is_string($value)
            && filter_var($value, FILTER_VALIDATE_URL) !== false
            && preg_match('#^https?://#i', $value) === 1);

        Validator::replacer('http_url', fn ($message, $attribute) => sprintf(
            'Isian %s harus berupa tautan yang diawali http:// atau https://.',
            self::HTTP_URL_LABELS[$attribute] ?? str_replace('_', ' ', $attribute)
        ));
    }
}
