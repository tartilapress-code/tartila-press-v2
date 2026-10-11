<?php

namespace App\Observers;

use App\Models\WalletWithdrawal;
use App\Services\NotificationLedger;
use App\Services\Notifier;

/** Penarikan saldo: permintaan baru → admin; dibayar/ditolak → pemilik. */
class WalletWithdrawalObserver
{
    public bool $afterCommit = true;

    public function __construct(private readonly Notifier $notifier) {}

    public function created(WalletWithdrawal $withdrawal): void
    {
        $this->notifier->guard(fn () => $this->handleCreated($withdrawal));
    }

    private function handleCreated(WalletWithdrawal $withdrawal): void
    {
        $withdrawal->loadMissing('user');

        $this->notifier->notifyAdmins(
            'admin_withdrawal',
            'Permintaan penarikan saldo',
            ($withdrawal->user?->name ?? 'User').' · '.OrderStatusHistoryObserver::rupiah((float) $withdrawal->amount),
            '/admin/withdrawals',
            ['subject_type' => 'withdrawal', 'subject_id' => $withdrawal->id]
        );
    }

    public function updated(WalletWithdrawal $withdrawal): void
    {
        $this->notifier->guard(fn () => $this->handleUpdated($withdrawal));
    }

    private function handleUpdated(WalletWithdrawal $withdrawal): void
    {
        if (! $withdrawal->wasChanged('status') || ! in_array($withdrawal->status, ['paid', 'rejected'], true)
            || ! app(NotificationLedger::class)->once("withdrawal:{$withdrawal->id}:{$withdrawal->status}")) {
            return;
        }

        $amount = OrderStatusHistoryObserver::rupiah((float) $withdrawal->amount);
        $paid = $withdrawal->status === 'paid';

        $this->notifier->notify(
            $withdrawal->user()->first(),
            'wallet',
            $paid ? "Penarikan saldo {$amount} sudah ditransfer" : "Penarikan saldo {$amount} ditolak",
            $paid
                ? 'Dana sudah ditransfer ke rekening '.$withdrawal->bank_name.'.'
                : ($withdrawal->admin_note ?: 'Dana dikembalikan ke saldo Anda.'),
            '/dashboard/dompet',
            ['subject_type' => 'withdrawal', 'subject_id' => $withdrawal->id]
        );
    }
}
