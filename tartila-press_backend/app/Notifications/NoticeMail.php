<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Email pemberitahuan (pesanan masuk, update naskah) berbahasa Indonesia. */
class NoticeMail extends Notification
{
    /**
     * @param  list<string>  $lines
     */
    public function __construct(
        public readonly string $title,
        public readonly array $lines,
        public readonly ?string $url = null,
        public readonly string $action = 'Buka di Tartila Press',
        public readonly ?string $name = null,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->title.' - Tartila Press')
            ->markdown('emails.notice', [
                'name' => self::plain((string) ($this->name ?? ($notifiable->name ?? ''))),
                'title' => self::plain($this->title),
                'lines' => array_map(self::plain(...), $this->lines),
                'url' => $this->url,
                'action' => $this->action,
            ]);
    }

    /**
     * Teks dari pengguna (judul naskah, catatan) tidak boleh menjadi
     * format/tautan Markdown di email resmi (mis. tautan phishing).
     */
    public static function plain(string $text): string
    {
        $text = preg_replace('/\s+/u', ' ', trim($text)) ?? '';

        return preg_replace('/([\\\\`*_{}\[\]()#+!|<>~-])/', '\\\\$1', $text) ?? $text;
    }
}
