<?php

namespace App\Observers;

use App\Models\Article;
use App\Models\Certificate;
use App\Models\EventRegistration;
use App\Models\RoleRequest;
use App\Models\VoucherGrant;
use App\Services\NotificationLedger;
use App\Services\Notifier;
use Illuminate\Database\Eloquent\Model;

/**
 * Notifikasi sederhana (tanpa email) untuk fitur lain: sertifikat baru, hak
 * voucher, artikel, permintaan role, pendaftaran event.
 */
class SimpleNoticeObserver
{
    public bool $afterCommit = true;

    private const ROLE_LABELS = ['penulis' => 'Penulis', 'editor' => 'Editor'];

    public function __construct(private readonly Notifier $notifier) {}

    public function created(Model $model): void
    {
        $this->notifier->guard(fn () => $this->handleCreated($model));
    }

    private function handleCreated(Model $model): void
    {
        match (true) {
            $model instanceof Certificate => $this->certificate($model),
            $model instanceof VoucherGrant => $this->notifier->notify(
                $model->user()->first(), 'voucher', 'Anda mendapat hak membuat voucher', $model->name,
                '/dashboard/voucher-saya', ['subject_type' => 'voucher_grant', 'subject_id' => $model->id]
            ),
            $model instanceof Article && $model->status === 'pending' => $this->notifier->notifyAdmins(
                'admin_article', 'Artikel baru menunggu review', $model->title, '/admin/articles',
                ['subject_type' => 'article', 'subject_id' => $model->id]
            ),
            $model instanceof RoleRequest && $model->status === 'pending' => $this->notifier->notifyAdmins(
                'admin_role', 'Permintaan role '.(self::ROLE_LABELS[$model->requested_role] ?? $model->requested_role),
                $model->user()->value('name'), '/admin', ['subject_type' => 'role_request', 'subject_id' => $model->id]
            ),
            default => null,
        };
    }

    public function updated(Model $model): void
    {
        $this->notifier->guard(fn () => $this->handleUpdated($model));
    }

    private function handleUpdated(Model $model): void
    {
        if (! $model->wasChanged('status')
            || ! app(NotificationLedger::class)->once(class_basename($model).":{$model->getKey()}:{$model->status}")) {
            return;
        }

        if ($model instanceof Article && in_array($model->status, ['approved', 'rejected'], true)) {
            $this->notifier->notify(
                $model->user()->first(), 'article',
                $model->status === 'approved' ? 'Artikel Anda diterbitkan' : 'Artikel Anda ditolak',
                $model->title, '/dashboard/artikel-saya', ['subject_type' => 'article', 'subject_id' => $model->id]
            );
        }

        if ($model instanceof RoleRequest && in_array($model->status, ['approved', 'rejected'], true)) {
            $role = self::ROLE_LABELS[$model->requested_role] ?? $model->requested_role;
            $this->notifier->notify(
                $model->user()->first(), 'role',
                $model->status === 'approved' ? "Permintaan role {$role} disetujui" : "Permintaan role {$role} ditolak",
                $model->note, '/dashboard/akun', ['subject_type' => 'role_request', 'subject_id' => $model->id]
            );
        }

        if ($model instanceof EventRegistration && in_array($model->status, ['confirmed', 'cancelled'], true)) {
            $event = $model->event()->value('title');
            $this->notifier->notify(
                $model->user()->first(), 'event',
                $model->status === 'confirmed' ? 'Pendaftaran event dikonfirmasi' : 'Pendaftaran event dibatalkan',
                $event, '/dashboard/event-saya', ['subject_type' => 'event_registration', 'subject_id' => $model->id]
            );
        }
    }

    private function certificate(Certificate $certificate): void
    {
        $about = $certificate->type === Certificate::TYPE_EVENT
            ? $certificate->attendance()->first()?->event()->value('title')
            : $certificate->book()->value('title');

        $this->notifier->notify(
            $certificate->user()->first(), 'certificate', 'Sertifikat baru tersedia', $about,
            '/dashboard/sertifikat-saya', ['subject_type' => 'certificate', 'subject_id' => $certificate->id]
        );
    }
}
