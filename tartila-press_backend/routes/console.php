<?php

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
