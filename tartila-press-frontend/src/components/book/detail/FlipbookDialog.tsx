import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * Jendela layar penuh untuk flipbook, memakai elemen <dialog> bawaan browser
 * (fokus terperangkap di dalamnya, Esc menutup, latar belakang tidak bisa
 * diklik). Menutup lewat Esc, klik latar, atau tombol di dalam isinya
 * memanggil `onClose`.
 */
export default function FlipbookDialog({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const dialog = dialogRef.current;

        if (!dialog) {
            return;
        }

        // Dipasang manual (bukan onClose React). Event `close` dikirim
        // tertunda, jadi yang berasal dari penutupan oleh efek pembersih
        // (mis. StrictMode memasang ulang efek) bisa tiba saat dialog sudah
        // dibuka lagi — abaikan.
        const handleClose = () => {
            if (!dialog.open) onCloseRef.current();
        };
        dialog.addEventListener('close', handleClose);

        if (!dialog.open) {
            dialog.showModal();
        }

        const root = document.documentElement;
        const previousOverflow = root.style.overflow;
        root.style.overflow = 'hidden';

        return () => {
            dialog.removeEventListener('close', handleClose);
            root.style.overflow = previousOverflow;

            if (dialog.open) {
                dialog.close();
            }
        };
    }, []);

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-label={t('books.detail.flipbook.dialogAria', { title })}
            onClick={(event) => {
                // Klik di luar isi (pada latar dialog) menutupnya.
                if (event.target === event.currentTarget) {
                    event.currentTarget.close();
                }
            }}
            className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-white backdrop:bg-oxford-navy-900/85 backdrop:backdrop-blur-sm"
        >
            <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-3 pb-4 pt-4 sm:px-6">
                <h2 className="font-display line-clamp-1 pb-3 text-lg font-bold text-white sm:text-xl">
                    {title}
                </h2>
                <div className="min-h-0 flex-1">{children}</div>
            </div>
        </dialog>,
        document.body
    );
}
