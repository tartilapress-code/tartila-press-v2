import { useEffect, useState } from 'react';

/**
 * Hitung mundur per detik — untuk menahan tombol "kirim ulang" sesaat
 * setelah dipakai. `remaining` > 0 berarti masih menunggu.
 */
export function useCooldown() {
    const [remaining, setRemaining] = useState<number>(0);

    useEffect(() => {
        if (remaining <= 0) {
            return;
        }

        const timer = window.setTimeout(
            () => setRemaining((seconds) => seconds - 1),
            1000
        );

        return () => window.clearTimeout(timer);
    }, [remaining]);

    return { remaining, start: (seconds: number) => setRemaining(seconds) };
}
