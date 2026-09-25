import { useEffect, type RefObject } from 'react';

/** Menutup panel yang terbuka saat pengguna mengklik di luarnya atau menekan Escape. */
export function useDismiss(
    open: boolean,
    onClose: () => void,
    ref: RefObject<HTMLElement | null>
): void {
    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose, ref]);
}
