// Waktu event selalu ditampilkan dalam WIB, apa pun zona waktu pengunjung,
// jadi opsi formatnya mengunci zona waktu Asia/Jakarta.
const timeZone = 'Asia/Jakarta';

/** Tanggal event: "24 September 2026". */
export const EVENT_DATE: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
};

/** Jam event (24 jam): "09.00" (Indonesia) atau "09:00". */
export const EVENT_TIME: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
};

/** Hari, tanggal, dan jam lengkap: "Kamis, 24 September 2026 pukul 09.00". */
export const EVENT_DATE_TIME: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    ...EVENT_DATE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
};
