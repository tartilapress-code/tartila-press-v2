import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiStarFill } from '@remixicon/react';

const STARS = [1, 2, 3, 4, 5];

/**
 * Pilihan penilaian 1–5 bintang. Memakai radio bawaan browser (tersembunyi)
 * sehingga bisa dioperasikan dengan keyboard dan dibaca pembaca layar.
 */
export default function StarRatingInput({
    value,
    onChange,
    name = 'rating',
}: {
    value: number;
    onChange: (value: number) => void;
    name?: string;
}) {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState<number>(0);
    const shown = hovered || value;
    const labels = [
        t('books.detail.stars.label1'),
        t('books.detail.stars.label2'),
        t('books.detail.stars.label3'),
        t('books.detail.stars.label4'),
        t('books.detail.stars.label5'),
    ];

    return (
        <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-oxford-navy-700">
                {t('books.detail.stars.legend')}
            </legend>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div
                    className="flex items-center"
                    onMouseLeave={() => setHovered(0)}
                >
                    {STARS.map((star) => (
                        <label
                            key={star}
                            onMouseEnter={() => setHovered(star)}
                            className="cursor-pointer rounded p-0.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-forest-moss-600"
                        >
                            <input
                                type="radio"
                                name={name}
                                value={star}
                                checked={value === star}
                                onChange={() => onChange(star)}
                                className="sr-only"
                            />
                            <span className="sr-only">
                                {t('books.detail.stars.star', { count: star })}
                            </span>
                            <RiStarFill
                                aria-hidden
                                className={`size-8 transition-colors ${
                                    shown >= star
                                        ? 'text-amber-400'
                                        : 'text-oxford-navy-900/15'
                                }`}
                            />
                        </label>
                    ))}
                </div>

                <span className="text-sm text-oxford-navy-900/60">
                    {shown > 0 ? labels[shown - 1] : ''}
                </span>
            </div>
        </fieldset>
    );
}
