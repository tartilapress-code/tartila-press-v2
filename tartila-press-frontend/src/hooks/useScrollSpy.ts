import { useEffect, useState } from 'react';

/**
 * Menandai seksi yang sedang terlihat saat halaman digulir (untuk navigasi
 * samping). Seksi terakhir dianggap aktif bila halaman sudah mentok di bawah,
 * karena seksi pendek di ujung halaman tidak pernah mencapai garis acuan.
 */
export function useScrollSpy(ids: string[]): string {
    const [active, setActive] = useState<string>(ids[0] ?? '');
    const key = ids.join('|');

    useEffect(() => {
        const list = key ? key.split('|') : [];

        if (list.length === 0) {
            return;
        }

        let frame = 0;

        function update() {
            frame = 0;

            // Garis acuan di 30% tinggi layar: seksi terakhir yang sudah
            // melewatinya adalah seksi aktif.
            const line = window.innerHeight * 0.3;
            let current = list[0];

            for (const id of list) {
                const element = document.getElementById(id);

                if (element && element.getBoundingClientRect().top <= line) {
                    current = id;
                }
            }

            // Halaman yang terlalu pendek untuk digulir (scrollY 0) tetap
            // menyorot seksi pertama, bukan yang terakhir.
            const atBottom =
                window.scrollY > 0 &&
                window.innerHeight + window.scrollY >=
                    document.documentElement.scrollHeight - 4;

            setActive(atBottom ? list[list.length - 1] : current);
        }

        function schedule() {
            if (!frame) {
                frame = requestAnimationFrame(update);
            }
        }

        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [key]);

    return active;
}
