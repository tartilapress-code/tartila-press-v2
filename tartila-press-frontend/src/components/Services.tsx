import { useTranslation } from 'react-i18next';
import ServiceItemCard, {
    ServiceItemCardSkeleton,
} from '@/components/service/ServiceItemCard';
import { useCustomItems } from '@/hooks/useCustomItems';

const COUNT = 6;

/**
 * Cuplikan layanan di beranda: item custom yang tersedia (layanan dulu, lalu
 * fasilitas) dengan harganya. Daftar lengkap ada di halaman Layanan.
 */
export default function Services({ limit = COUNT }: { limit?: number }) {
    const { t } = useTranslation();
    const { items, isLoading } = useCustomItems();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <ServiceItemCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                {t('services.empty')}
            </p>
        );
    }

    const ordered = [
        ...items.filter((item) => item.type === 'service'),
        ...items.filter((item) => item.type === 'facility'),
    ];

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {ordered.slice(0, limit).map((item) => (
                <ServiceItemCard key={item.id} item={item} showType />
            ))}
        </div>
    );
}
