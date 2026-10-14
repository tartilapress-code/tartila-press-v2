import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RiCheckLine } from '@remixicon/react';
import { ISBN_TYPES, type IsbnType } from '@/lib/isbnTypes';

export type IsbnChoice = {
    type: IsbnType;
    /** Harga setelah diskon (kosong = tanpa harga, mis. formulir Book Chapter). */
    price?: number;
    /** Harga sebelum diskon (dicoret bila lebih besar dari price). */
    originalPrice?: number;
};

type Props = {
    /** Jenis yang boleh dipilih; urutan tampil mengikuti ISBN_TYPES. */
    choices: IsbnChoice[];
    value: IsbnType | null;
    onChange: (type: IsbnType) => void;
    formatPrice?: (amount: number) => string;
    /** Nama kelompok radio (unik per halaman). */
    name?: string;
    error?: string;
    /** Catatan tambahan di bawah tiap pilihan (mis. biaya minimal Book Chapter). */
    footer?: (type: IsbnType) => ReactNode;
};

/**
 * Pilihan jenis ISBN (cetak / digital / keduanya) lengkap dengan penjelasan perbedaan dan
 * kegunaannya, dipakai di halaman paket, pemesanan, dan formulir Book Chapter.
 */
export default function IsbnTypeSelector({
    choices,
    value,
    onChange,
    formatPrice,
    name,
    error,
    footer,
}: Props) {
    const { t } = useTranslation();
    const groupId = useId();
    const group = name ?? groupId;
    const ordered = ISBN_TYPES.map((type) =>
        choices.find((choice) => choice.type === type)
    ).filter((choice): choice is IsbnChoice => choice !== undefined);

    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="font-display text-base font-bold text-oxford-navy-700">
                {t('isbn.chooseTitle')}
            </legend>
            <p className="text-sm text-oxford-navy-900/65">
                {t('isbn.chooseHint')}
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {ordered.map((choice) => {
                    const selected = value === choice.type;
                    const uses = t(`isbn.types.${choice.type}.uses`, {
                        returnObjects: true,
                    }) as unknown as string[];

                    return (
                        <label
                            key={choice.type}
                            className={`flex cursor-pointer flex-col gap-2 rounded-xl p-4 ring-1 transition-colors ${
                                selected
                                    ? 'bg-forest-moss-50 ring-2 ring-forest-moss-600'
                                    : 'bg-white ring-forest-moss-100 hover:bg-forest-moss-50/60'
                            }`}
                        >
                            <span className="flex items-start justify-between gap-2">
                                <span className="flex items-center gap-2 font-semibold text-oxford-navy-700">
                                    <input
                                        type="radio"
                                        name={group}
                                        value={choice.type}
                                        checked={selected}
                                        onChange={() => onChange(choice.type)}
                                        className="size-4 accent-forest-moss-700"
                                    />
                                    {t(`isbn.types.${choice.type}.label`)}
                                </span>
                                {selected && (
                                    <RiCheckLine
                                        aria-hidden
                                        className="size-5 shrink-0 text-forest-moss-700"
                                    />
                                )}
                            </span>

                            {choice.price !== undefined && formatPrice && (
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                    {choice.originalPrice !== undefined &&
                                        choice.originalPrice > choice.price && (
                                            <span className="text-sm text-oxford-navy-900/55 line-through">
                                                {formatPrice(
                                                    choice.originalPrice
                                                )}
                                            </span>
                                        )}
                                    <span className="text-lg font-bold text-oxford-navy-700">
                                        {formatPrice(choice.price)}
                                    </span>
                                </span>
                            )}

                            <span className="text-sm text-oxford-navy-900/80">
                                {t(`isbn.types.${choice.type}.summary`)}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/55">
                                {t('isbn.uses')}
                            </span>
                            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-oxford-navy-900/75">
                                {uses.map((use) => (
                                    <li key={use}>{use}</li>
                                ))}
                            </ul>
                            <span className="text-xs italic text-oxford-navy-900/65">
                                {t(`isbn.types.${choice.type}.suits`)}
                            </span>
                            {footer?.(choice.type)}
                        </label>
                    );
                })}
            </div>

            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
