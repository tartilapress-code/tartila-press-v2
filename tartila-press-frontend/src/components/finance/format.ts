const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

export function rupiah(amount: number): string {
    return rupiahFormatter.format(amount);
}

/** "Rp 1,2 jt" untuk sumbu grafik. */
export function rupiahCompact(amount: number): string {
    return `Rp ${compactFormatter.format(amount)}`;
}

export function formatDate(iso: string | null): string {
    if (!iso) return '-';

    const date = new Date(iso);

    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}

export const STATUS_LABELS: Record<string, string> = {
    completed: 'Selesai',
    hold: 'Hold',
};

/** Kelas warna untuk lencana status transaksi. */
export function statusClass(status: string): string {
    return status === 'completed'
        ? 'bg-forest-moss-100 text-forest-moss-800'
        : 'bg-amber-100 text-amber-900';
}

/** Kelas warna untuk angka laba/rugi. */
export function profitClass(amount: number): string {
    return amount < 0 ? 'text-red-700' : 'text-forest-moss-800';
}
