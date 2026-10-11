import { useEffect } from 'react';
import { RiCloseLine, RiExternalLinkLine } from '@remixicon/react';

type PdfPreviewModalProps = {
    /** Object URL of the PDF. */
    url: string;
    title: string;
    onClose: () => void;
};

/** Full-screen viewer for a generated PDF (the browser's own PDF viewer). */
export default function PdfPreviewModal({
    url,
    title,
    onClose,
}: PdfPreviewModalProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex flex-col bg-oxford-navy-900/70 p-3 sm:p-6"
        >
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex flex-row items-center justify-between gap-3 border-b border-forest-moss-100 px-4 py-3">
                    <h2 className="font-display text-oxford-navy-700 truncate text-base font-bold">
                        {title}
                    </h2>
                    <div className="flex shrink-0 flex-row items-center gap-3">
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-forest-moss-700 hover:text-forest-moss-800 inline-flex items-center gap-1 text-sm underline"
                        >
                            <RiExternalLinkLine
                                aria-hidden
                                className="size-4"
                            />
                            Buka di tab baru
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Tutup pratinjau"
                            className="text-oxford-navy-700 hover:bg-forest-moss-50 rounded-lg p-1.5"
                        >
                            <RiCloseLine aria-hidden className="size-6" />
                        </button>
                    </div>
                </div>
                <iframe
                    src={url}
                    title={title}
                    className="h-full w-full flex-1 bg-forest-moss-50"
                />
            </div>
        </div>
    );
}
