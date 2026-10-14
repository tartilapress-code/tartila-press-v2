import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/Button/Button';
import type { IsbnType } from '@/lib/isbnTypes';
import IsbnTypeSelector, { type IsbnChoice } from './IsbnTypeSelector';

type Props = {
    choices: IsbnChoice[];
    formatPrice: (amount: number) => string;
    initial?: IsbnType | null;
    onConfirm: (type: IsbnType) => void;
    onCancel: () => void;
};

/** Popup untuk memilih jenis ISBN bila pembeli belum memilih saat memesan paket. */
export default function IsbnTypeDialog({
    choices,
    formatPrice,
    initial = null,
    onConfirm,
    onCancel,
}: Props) {
    const { t } = useTranslation();
    const [value, setValue] = useState<IsbnType | null>(initial);
    const [showError, setShowError] = useState<boolean>(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel();
        };

        document.addEventListener('keydown', onKey);

        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('isbn.dialog.title')}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-oxford-navy-900/70 p-3"
        >
            <div className="flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
                <h2 className="font-display text-xl font-bold text-oxford-navy-700">
                    {t('isbn.dialog.title')}
                </h2>
                <p className="text-sm text-oxford-navy-900/70">
                    {t('isbn.dialog.text')}
                </p>

                <IsbnTypeSelector
                    name="isbn-dialog"
                    choices={choices}
                    value={value}
                    onChange={(type) => {
                        setValue(type);
                        setShowError(false);
                    }}
                    formatPrice={formatPrice}
                    error={showError ? t('isbn.required') : undefined}
                />

                <div className="flex flex-row flex-wrap justify-end gap-3">
                    <Button variant="outline2" onClick={onCancel}>
                        {t('isbn.dialog.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() =>
                            value ? onConfirm(value) : setShowError(true)
                        }
                    >
                        {t('isbn.dialog.confirm')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
