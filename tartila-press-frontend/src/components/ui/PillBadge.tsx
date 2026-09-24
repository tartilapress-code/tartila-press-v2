import { RiLeafLine } from '@remixicon/react';

/**
 * Lencana berbentuk pil hijau lembut (peran, jenis proyek, dsb.). `withIcon` menambahkan ikon daun
 * (dipakai di hero); tanpa ikon dipakai sebagai chip kecil di kartu.
 */
export default function PillBadge({
    label,
    withIcon = false,
}: {
    label: string;
    withIcon?: boolean;
}) {
    return (
        <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-moss-100 font-medium text-forest-moss-800 ${
                withIcon ? 'px-3.5 py-1.5 text-sm' : 'px-3 py-1 text-xs'
            }`}
        >
            {withIcon && <RiLeafLine aria-hidden className="size-4" />}
            {label}
        </span>
    );
}
