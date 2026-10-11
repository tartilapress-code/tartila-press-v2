import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RiCloseLine } from '@remixicon/react';

/** Foto ukuran penuh di atas halaman; tutup dengan Esc, tombol, atau klik latar. */
export default function ImageLightbox({
    src,
    title,
    description,
    onClose,
}: {
    src: string;
    title: string;
    description?: string | null;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }

        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener('keydown', handleKey);
            previous?.focus();
        };
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-oxford-navy-900/80 p-4"
            onClick={onClose}
        >
            <figure
                className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label={t('about.close')}
                    className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-oxford-navy-800 shadow ring-1 ring-forest-moss-100 transition-colors hover:bg-white"
                >
                    <RiCloseLine size={22} aria-hidden />
                </button>
                <img
                    src={src}
                    alt={title}
                    className="max-h-[75vh] w-full bg-forest-moss-50 object-contain"
                />
                <figcaption className="flex flex-col gap-1 p-4">
                    <span className="font-display text-lg font-bold text-oxford-navy-700">
                        {title}
                    </span>
                    {description && (
                        <span className="whitespace-pre-line text-sm text-oxford-navy-900/70">
                            {description}
                        </span>
                    )}
                </figcaption>
            </figure>
        </div>
    );
}
