const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

/** "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu", lalu tanggal. */
export function timeAgo(iso: string, now: number = Date.now()): string {
    const time = new Date(iso).getTime();

    if (Number.isNaN(time)) {
        return '';
    }

    const minutes = Math.floor((now - time) / 60_000);

    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours} jam lalu`;

    const days = Math.floor(hours / 24);

    if (days < 7) return `${days} hari lalu`;

    return dateFormatter.format(new Date(time));
}
