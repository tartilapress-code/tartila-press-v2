/** Saves a Blob as a file through a temporary link click. */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Give the browser a moment to start the download before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
