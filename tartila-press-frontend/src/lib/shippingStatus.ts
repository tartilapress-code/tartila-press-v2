export const SHIPPING_STAGES = [
    { value: 'pending', label: 'Menunggu Konfirmasi Admin' },
    { value: 'confirmed', label: 'Pesanan Dikonfirmasi' },
    { value: 'printing', label: 'Proses Cetak' },
    { value: 'packing', label: 'Proses Packing' },
    { value: 'shipping', label: 'Proses Pengiriman' },
    { value: 'awaiting_confirmation', label: 'Menunggu Konfirmasi Diterima' },
    { value: 'delivered', label: 'Selesai - Buku Sudah Sampai' },
    { value: 'cancelled', label: 'Dibatalkan' },
] as const;

export const SHIPPING_STAGE_LABELS: Record<string, string> = Object.fromEntries(
    SHIPPING_STAGES.map((stage) => [stage.value, stage.label])
);
