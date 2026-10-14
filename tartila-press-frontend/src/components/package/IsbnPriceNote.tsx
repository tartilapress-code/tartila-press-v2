import { useTranslation } from 'react-i18next';
import type { IsbnOption } from '@/lib/isbnTypes';

/**
 * Catatan di bawah harga paket: harga yang tampil adalah harga ISBN Cetak (bawaan), dan jenis
 * ISBN lain yang tersedia (dipilih saat memesan).
 */
export default function IsbnPriceNote({
    options,
    className = '',
}: {
    options: IsbnOption[] | undefined;
    className?: string;
}) {
    const { t } = useTranslation();

    if (!options || options.length === 0) {
        return null;
    }

    const first = options[0];
    const others = options
        .slice(1)
        .map((option) => t(`isbn.types.${option.type}.label`));

    return (
        <p className={`text-xs text-oxford-navy-900/65 ${className}`}>
            {t('isbn.priceFor', { type: t(`isbn.types.${first.type}.label`) })}
            {others.length > 0 &&
                ` · ${t('isbn.alsoAvailable', { types: others.join(', ') })}`}
        </p>
    );
}
