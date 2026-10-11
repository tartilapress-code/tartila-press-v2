import { STATUS_LABEL, type VoucherStatus } from '@/data/voucher/voucherApi';

const BADGE_CLASS: Record<VoucherStatus | 'none', string> = {
    active: 'bg-forest-moss-100 text-forest-moss-800',
    scheduled: 'bg-sky-100 text-sky-800',
    expired: 'bg-oxford-navy-100 text-oxford-navy-700',
    exhausted: 'bg-amber-100 text-amber-800',
    inactive: 'bg-oxford-navy-100 text-oxford-navy-700',
    reset: 'bg-red-100 text-red-700',
    none: 'bg-oxford-navy-50 text-oxford-navy-700',
};

export default function StatusBadge({
    status,
    label,
}: {
    status: VoucherStatus | 'none';
    label?: string;
}) {
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[status]}`}
        >
            {label ??
                (status === 'none' ? 'Tanpa diskon' : STATUS_LABEL[status])}
        </span>
    );
}
