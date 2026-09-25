import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RiCheckLine,
    RiCustomerService2Line,
    RiStackLine,
} from '@remixicon/react';
import PillBadge from '@/components/ui/PillBadge';
import type { CustomItem } from '@/data/customPackageItem/customPackageItemApi';
import { useFormat } from '@/i18n/useFormat';

const TYPE_META = {
    facility: { Icon: RiStackLine },
    service: { Icon: RiCustomerService2Line },
} as const;

const cardBase =
    'relative flex h-full flex-col gap-3 rounded-2xl border p-5 transition duration-300';

type ServiceItemCardProps = {
    item: CustomItem;
    // Bila `onToggle` diberikan, kartu menjadi kotak centang untuk merakit paket.
    selected?: boolean;
    onToggle?: (id: number) => void;
    // Lencana jenis (Layanan/Fasilitas), untuk daftar yang jenisnya bercampur.
    showType?: boolean;
};

/**
 * Kartu satu item custom: ikon jenis, nama, keterangan, dan harga (dengan
 * diskon bila ada). Dipakai untuk tampilan biasa (beranda) maupun untuk
 * dicentang di halaman Layanan.
 */
export default function ServiceItemCard({
    item,
    selected = false,
    onToggle,
    showType = false,
}: ServiceItemCardProps): ReactNode {
    const { t } = useTranslation();
    const { rupiah } = useFormat();
    const { Icon } = TYPE_META[item.type];
    const isSelectable = onToggle !== undefined;
    const priceLabel =
        item.final_price === 0 ? t('common.free') : rupiah(item.final_price);

    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <span
                    className={`flex size-11 items-center justify-center rounded-xl transition-colors ${
                        selected
                            ? 'bg-forest-moss-600 text-white'
                            : 'bg-forest-moss-100 text-forest-moss-700'
                    }`}
                >
                    <Icon aria-hidden className="size-6" />
                </span>
                {isSelectable ? (
                    <span
                        aria-hidden
                        className={`flex size-6 items-center justify-center rounded-md border transition-colors ${
                            selected
                                ? 'border-forest-moss-600 bg-forest-moss-600 text-white'
                                : 'border-oxford-navy-900/20 bg-white text-transparent'
                        }`}
                    >
                        <RiCheckLine className="size-4" />
                    </span>
                ) : (
                    showType && (
                        <PillBadge label={t(`services.type.${item.type}`)} />
                    )
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-lg font-bold leading-snug text-oxford-navy-700">
                    {item.name}
                </h3>
                {item.description && (
                    <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-oxford-navy-900/70">
                        {item.description}
                    </p>
                )}
            </div>

            <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-1">
                {item.discount > 0 && (
                    <span className="text-sm text-oxford-navy-900/65 line-through">
                        {rupiah(Number(item.price))}
                    </span>
                )}
                <span className="text-lg font-bold text-oxford-navy-700">
                    {priceLabel}
                </span>
                {item.discount > 0 && (
                    <span className="rounded-full bg-forest-moss-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                        {t('common.discount', { percent: item.discount })}
                    </span>
                )}
            </div>
        </>
    );

    if (isSelectable) {
        return (
            <label
                className={`${cardBase} cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest-moss-500 ${
                    selected
                        ? 'border-forest-moss-500 bg-forest-moss-50 ring-1 ring-forest-moss-500'
                        : 'border-forest-moss-100 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] hover:border-forest-moss-300'
                }`}
            >
                <input
                    type="checkbox"
                    className="sr-only"
                    aria-label={t('services.itemAria', {
                        name: item.name,
                        price: priceLabel,
                    })}
                    checked={selected}
                    onChange={() => onToggle(item.id)}
                />
                {content}
            </label>
        );
    }

    return (
        <div
            className={`${cardBase} border-forest-moss-100 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] hover:-translate-y-1 hover:shadow-[0_14px_30px_-16px_rgba(1,26,44,0.32)]`}
        >
            {content}
        </div>
    );
}

/** Kerangka kartu saat item masih dimuat. */
export function ServiceItemCardSkeleton(): ReactNode {
    return (
        <div
            aria-hidden
            className="flex h-40 animate-pulse flex-col gap-3 rounded-2xl border border-forest-moss-100 bg-white p-5"
        >
            <div className="size-11 rounded-xl bg-forest-moss-100" />
            <div className="h-5 w-3/5 rounded bg-forest-moss-100" />
            <div className="mt-auto h-5 w-2/5 rounded bg-forest-moss-50" />
        </div>
    );
}
