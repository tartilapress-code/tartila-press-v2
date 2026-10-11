<?php

namespace App\Console\Commands;

use App\Services\OrderStatusService;
use Illuminate\Console\Command;

class CancelUnpaidOrders extends Command
{
    protected $signature = 'orders:cancel-unpaid';

    protected $description = 'Batalkan pesanan yang belum mengunggah bukti transfer dalam 1×24 jam (batas bayar invoice).';

    public function handle(OrderStatusService $orders): int
    {
        $count = $orders->cancelOverdue();

        $this->info("{$count} pesanan dibatalkan karena melewati batas pembayaran.");

        return self::SUCCESS;
    }
}
