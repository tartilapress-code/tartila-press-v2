<?php

namespace App\Observers;

use App\Models\IsbnApplication;
use App\Services\NotificationLedger;
use App\Services\Notifier;

/** Surat ISBN: ditandatangani pemohon → admin; diproses admin → pemohon. */
class IsbnApplicationObserver
{
    public bool $afterCommit = true;

    public function __construct(private readonly Notifier $notifier) {}

    public function updated(IsbnApplication $application): void
    {
        $this->notifier->guard(fn () => $this->handleUpdated($application));
    }

    private function handleUpdated(IsbnApplication $application): void
    {
        if (! $application->wasChanged('status')
            || ! app(NotificationLedger::class)->once("isbn:{$application->id}:{$application->status}")) {
            return;
        }

        $subject = ['subject_type' => 'isbn', 'subject_id' => $application->id];

        if ($application->status === IsbnApplication::STATUS_SIGNED) {
            $this->notifier->notifyAdmins('admin_isbn', 'Surat ISBN siap diproses', $application->title, '/admin/terbitkan-naskah', $subject);
        }

        if ($application->status === IsbnApplication::STATUS_PROCESSED) {
            $this->notifier->notify(
                $application->applicant()->first(),
                'isbn',
                'Surat permohonan ISBN sudah diproses admin',
                $application->title,
                "/dashboard/isbn/{$application->id}",
                $subject
            );
        }
    }
}
