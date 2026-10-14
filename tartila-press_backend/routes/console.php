<?php

use App\Models\UserNotification;
use App\Services\Cover\CoverService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Catatan: pendaftaran ini hanya mengajarkan scheduler Laravel soal job-nya.
// Supaya benar-benar jalan otomatis di production, tetap perlu 1 baris cron
// asli di server: `* * * * * php artisan schedule:run`.
Schedule::command('book-chapters:revert-expired')->daily();
Schedule::command('book-shipments:auto-confirm-delivery')->daily();
// Invoice: pesanan tanpa bukti transfer dibatalkan setelah 1×24 jam.
Schedule::command('orders:cancel-unpaid')->everyTenMinutes()->withoutOverlapping();
// Tartila Book: pesanan beli/langganan tanpa bukti transfer dibatalkan setelah 1×24 jam.
Schedule::command('reader:cancel-unpaid')->everyTenMinutes()->withoutOverlapping();

// Cover: tutup voting yang sudah 24 jam; ingatkan lalu hapus berkas cover/revisi 7 hari setelah buku terbit.
Schedule::call(fn () => app(CoverService::class)->tickAll())->everyTenMinutes()->name('covers-close-voting');
Schedule::call(function () {
    $covers = app(CoverService::class);
    $covers->warnDue();
    $covers->purgeDue();
})->daily()->name('covers-purge');

// Notifikasi lama dibersihkan: yang sudah dibaca > 90 hari, semua > 1 tahun.
Schedule::call(function () {
    UserNotification::whereNotNull('read_at')->where('read_at', '<', now()->subDays(90))->delete();
    UserNotification::where('created_at', '<', now()->subYear())->delete();
})->daily()->name('prune-user-notifications');
