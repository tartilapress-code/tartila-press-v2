/** Lencana pil hijau lembut; `withIcon` menambah ikon daun (untuk hero). */
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
            {withIcon && <i aria-hidden className="ri-leaf-line text-base" />}
            {label}
        </span>
    );
}
