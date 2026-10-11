<?php

namespace App\Console\Commands;

use App\Services\Reader\ReaderOrderService;
use Illuminate\Console\Command;

class CancelUnpaidReaderOrders extends Command
{
    protected $signature = 'reader:cancel-unpaid';

    protected $description = 'Batalkan pesanan Tartila Book yang belum mengunggah bukti transfer dalam 1×24 jam.';

    public function handle(ReaderOrderService $orders): int
    {
        $this->info($orders->cancelOverdue().' pesanan Tartila Book dibatalkan karena melewati batas pembayaran.');

        return self::SUCCESS;
    }
}
