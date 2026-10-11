// <input type="datetime-local"> carries no time zone. Send it to the API as an
// ISO string (UTC) so the server does not misread it, and turn the ISO string
// the API returns back into the browser's local "YYYY-MM-DDTHH:mm".

export function toIso(local: string | null | undefined): string | null {
    return local ? new Date(local).toISOString() : null;
}

export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }

    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
