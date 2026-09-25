<?php

namespace App\Console\Commands;

use App\Models\BookShipment;
use Illuminate\Console\Command;

class AutoConfirmBookDelivery extends Command
{
    protected $signature = 'book-shipments:auto-confirm-delivery';

    protected $description = 'Tandai buku sudah sampai untuk pengiriman yang sudah 2 hari menunggu konfirmasi pembeli tanpa respons.';

    public function handle(): int
    {
        $shipments = BookShipment::where('status', 'awaiting_confirmation')
            ->where('awaiting_confirmation_at', '<=', now()->subDays(2))
            ->get();

        foreach ($shipments as $shipment) {
            $shipment->markDelivered('auto');

            $this->info("Shipment #{$shipment->id} (order #{$shipment->order_id}): otomatis ditandai sampai.");
        }

        $this->info($shipments->count().' pengiriman dikonfirmasi otomatis.');

        return self::SUCCESS;
    }
}
