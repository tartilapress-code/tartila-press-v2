<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserNotification;
use App\Notifications\NoticeMail;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Pusat notifikasi: notifikasi di aplikasi (lonceng + tanda merah per menu)
 * dan email. Email dikirim SETELAH respons selesai (tanpa antrean/worker)
 * dan kegagalan SMTP hanya dicatat di log, tidak menggagalkan aksi user.
 * Orang yang melakukan aksinya sendiri tidak diberi notifikasi.
 */
class Notifier
{
    /**
     * @param  User|iterable<User|null>  $users
     * @param  array{subject_type?: string|null, subject_id?: int|null, email?: bool, email_lines?: list<string>}  $options
     */
    public function notify(User|iterable|null $users, string $category, string $title, ?string $body = null, ?string $link = null, array $options = []): void
    {
        if ($users === null) {
            return;
        }

        $recipients = $this->recipients($users);

        if ($recipients->isEmpty()) {
            return;
        }

        $now = now();

        UserNotification::insert($recipients->map(fn (User $user) => [
            'user_id' => $user->id,
            'category' => $category,
            'title' => mb_substr($title, 0, 255),
            'body' => $body,
            'link' => $link,
            'subject_type' => $options['subject_type'] ?? null,
            'subject_id' => $options['subject_id'] ?? null,
            'read_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());

        if (! empty($options['email'])) {
            $lines = $options['email_lines'] ?? array_values(array_filter([$body]));

            foreach ($recipients as $user) {
                if ($user->email) {
                    $this->mail(fn () => $user->notify(new NoticeMail($title, $lines, $this->url($link))));
                }
            }
        }
    }

    /**
     * Jalankan pengiriman notifikasi tanpa pernah menggagalkan aksi utama
     * (data sudah tersimpan saat observer "afterCommit" berjalan).
     */
    public function guard(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $exception) {
            if (config('app.notifications_strict')) {
                throw $exception;
            }

            Log::warning('Notifikasi gagal dibuat: '.$exception->getMessage(), ['exception' => $exception]);
        }
    }

    /** Semua admin (kecuali yang sedang beraksi). */
    public function notifyAdmins(string $category, string $title, ?string $body = null, ?string $link = null, array $options = []): void
    {
        $this->notify($this->usersWithRole('admin'), $category, $title, $body, $link, $options);
    }

    /** Semua editor (mis. naskah baru di pool). */
    public function notifyEditors(string $category, string $title, ?string $body = null, ?string $link = null, array $options = []): void
    {
        $this->notify($this->usersWithRole('editor'), $category, $title, $body, $link, $options);
    }

    /**
     * Email ke alamat tetap (mis. email kantor untuk pesanan masuk).
     *
     * @param  list<string>  $lines
     */
    public function emailAddress(?string $address, string $title, array $lines, ?string $link = null): void
    {
        $address = trim((string) $address);

        if ($address === '' || ! filter_var($address, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $this->mail(fn () => Notification::route('mail', $address)
            ->notify(new NoticeMail($title, $lines, $this->url($link), 'Buka Panel Admin', 'Admin Tartila Press')));
    }

    /** Alamat lengkap halaman frontend. */
    public function url(?string $link): ?string
    {
        return $link ? rtrim((string) config('app.frontend_url'), '/').$link : null;
    }

    /** @return Collection<int, User> */
    private function recipients(User|iterable $users): Collection
    {
        $actorId = auth()->id();

        return collect($users instanceof User ? [$users] : $users)
            ->filter(fn ($user) => $user instanceof User && $user->id !== $actorId)
            ->unique('id')
            ->values();
    }

    /** @return EloquentCollection<int, User> */
    private function usersWithRole(string $role): EloquentCollection
    {
        return User::whereHas('roles', fn ($query) => $query->where('name', $role))->get();
    }

    private function mail(callable $send): void
    {
        $guarded = function () use ($send) {
            try {
                $send();
            } catch (Throwable $exception) {
                Log::warning('Email notifikasi gagal dikirim: '.$exception->getMessage());
            }
        };

        // Perintah terjadwal/tinker: kirim langsung. Permintaan HTTP: setelah
        // respons terkirim supaya halaman tidak menunggu SMTP.
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            $guarded();

            return;
        }

        defer($guarded);
    }
}
