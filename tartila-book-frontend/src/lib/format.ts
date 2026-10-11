const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export const formatRupiah = (value: number | string | null | undefined) =>
    rupiah.format(Number(value ?? 0));

const dateTime = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
});

const dateOnly = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
});

/** Tanggal & jam dalam WIB. */
export const formatDateTime = (value: string | null | undefined) =>
    value ? `${dateTime.format(new Date(value))} WIB` : '';

export const formatDate = (value: string | null | undefined) =>
    value ? dateOnly.format(new Date(value)) : '';

/** Nilai untuk <input type="datetime-local"> dalam WIB dari ISO. */
export function toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';

    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));

    return parts.replace(' ', 'T');
}

/** ISO dari isian datetime-local yang diartikan sebagai WIB (+07:00). */
export const fromDateTimeLocal = (value: string): string | null =>
    value ? new Date(`${value}:00+07:00`).toISOString() : null;

export const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes) return '';

    return bytes > 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.ceil(bytes / 1024)} KB`;
};
