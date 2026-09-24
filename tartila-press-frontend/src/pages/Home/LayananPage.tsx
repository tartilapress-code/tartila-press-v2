import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import { RiArrowRightLine } from '@remixicon/react';
import Card2Flip, {
    PackageCardSkeleton,
} from '@/components/card/flipcard/Card2Flip';
import ServiceItemCard, {
    ServiceItemCardSkeleton,
} from '@/components/service/ServiceItemCard';
import ServiceSummary from '@/components/service/ServiceSummary';
import CtaBand from '@/components/ui/CtaBand';
import ListHero from '@/components/ui/ListHero';
import SectionTitle from '@/components/ui/SectionTitle';
import type { CustomItem } from '@/data/customPackageItem/customPackageItemApi';
import { useAuth } from '@/context/useAuth';
import { useCustomItems } from '@/hooks/useCustomItems';
import { usePackages } from '@/hooks/usePackages';
import { formatRupiah } from '@/lib/bookChapterPublic';
import { itemsTotal, packageOffers } from '@/lib/packageFeatures';

const OFFERS_ID = 'paket-hemat';

const cardClass =
    'flex flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6';

function ItemGroup({
    title,
    items,
    selectedIds,
    onToggle,
}: {
    title: string;
    items: CustomItem[];
    selectedIds: number[];
    onToggle: (id: number) => void;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-bold text-oxford-navy-700">
                {title}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {items.map((item) => (
                    <ServiceItemCard
                        key={item.id}
                        item={item}
                        selected={selectedIds.includes(item.id)}
                        onToggle={onToggle}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Halaman layanan: item custom (layanan dan fasilitas satuan) yang bisa
 * dicentang untuk merakit paket, lalu tawaran paket penerbitan yang lebih
 * hemat dari harga satuan.
 */
function LayananPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { items, isLoading: itemsLoading } = useCustomItems();
    const { packages, isLoading: packagesLoading } = usePackages();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const selected = items.filter((item) => selectedIds.includes(item.id));
    const total = itemsTotal(selected);
    const offers = packageOffers(packages, items, selected);
    const bestOffer = offers.packages[0];

    function toggleItem(id: number) {
        setSelectedIds((previous) =>
            previous.includes(id)
                ? previous.filter((itemId) => itemId !== id)
                : [...previous, id]
        );
    }

    // Pilihan dibawa ke halaman rakit paket; tamu diminta masuk dulu.
    function startCustomPackage() {
        if (selected.length === 0) {
            return;
        }

        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        const query = new URLSearchParams(
            selected.map((item) => ['item', String(item.id)])
        );
        navigate(`/dashboard/paket-custom?${query}`);
    }

    const offersText = {
        general:
            'Butuh beberapa layanan sekaligus? Paket menggabungkannya dalam satu harga, lebih hemat daripada membeli satuan.',
        selection: `${offers.packages.length} paket sudah mencakup semua pilihan Anda dan lebih hemat dari total ${formatRupiah(total)}.`,
        uncovered:
            'Belum ada paket yang mencakup semua pilihan Anda dengan harga lebih hemat. Berikut paket lain yang layak dipertimbangkan.',
    }[offers.mode];

    let hint = null;

    if (offers.mode === 'selection' && bestOffer) {
        hint = (
            <>
                <strong className="font-semibold">{bestOffer.name}</strong>{' '}
                sudah mencakup pilihan Anda dan lebih hemat.{' '}
                <HashLink
                    to={`#${OFFERS_ID}`}
                    smooth
                    className="font-semibold underline"
                >
                    Lihat paket
                </HashLink>
            </>
        );
    } else if (offers.mode === 'uncovered') {
        hint =
            'Belum ada paket yang mencakup semua pilihan Anda dengan harga lebih hemat.';
    }

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge="Layanan"
                title={{
                    before: 'Layanan Penerbitan ',
                    accent: 'Tartila Press',
                }}
                text="Dari naskah sampai buku terbit, kami dampingi setiap tahapnya dengan sistem yang modern, transparan, dan terpercaya."
                script={['Karya Anda,', 'Kami Terbitkan']}
            />

            <div className="mx-auto flex max-w-[1232px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <section aria-labelledby="layanan-title" className={cardClass}>
                    <div className="flex flex-col gap-2">
                        <SectionTitle id="layanan-title">
                            Layanan &amp; Fasilitas
                        </SectionTitle>
                        <p className="max-w-2xl pl-4 text-[15px] leading-relaxed text-oxford-navy-900/65">
                            Centang yang Anda butuhkan untuk merakit paket
                            custom sendiri.
                        </p>
                    </div>

                    {itemsLoading ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <ServiceItemCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            Belum ada layanan yang ditampilkan.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
                            <div className="flex flex-col gap-6">
                                <ItemGroup
                                    title="Layanan"
                                    items={items.filter(
                                        (item) => item.type === 'service'
                                    )}
                                    selectedIds={selectedIds}
                                    onToggle={toggleItem}
                                />
                                <ItemGroup
                                    title="Fasilitas"
                                    items={items.filter(
                                        (item) => item.type === 'facility'
                                    )}
                                    selectedIds={selectedIds}
                                    onToggle={toggleItem}
                                />
                            </div>

                            <ServiceSummary
                                count={selected.length}
                                total={total}
                                isAuthenticated={isAuthenticated}
                                hint={hint}
                                onStart={startCustomPackage}
                                onClear={() => setSelectedIds([])}
                            />
                        </div>
                    )}
                </section>

                {(packagesLoading || packages.length > 0) && (
                    <section
                        id={OFFERS_ID}
                        aria-labelledby="hemat-title"
                        className={`${cardClass} scroll-mt-24`}
                    >
                        <div className="flex flex-col gap-2">
                            <SectionTitle
                                id="hemat-title"
                                action={
                                    <Link
                                        to="/paket"
                                        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-oxford-navy-700 hover:underline"
                                    >
                                        Lihat semua paket
                                        <RiArrowRightLine
                                            aria-hidden
                                            className="size-4"
                                        />
                                    </Link>
                                }
                            >
                                Lebih Hemat dengan Paket Penerbitan
                            </SectionTitle>
                            <p
                                aria-live="polite"
                                className="max-w-2xl pl-4 text-[15px] leading-relaxed text-oxford-navy-900/65"
                            >
                                {offersText}
                            </p>
                        </div>

                        {packagesLoading ? (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <PackageCardSkeleton key={index} />
                                ))}
                            </div>
                        ) : (
                            <Card2Flip
                                packages={offers.packages}
                                highlights={offers.highlights}
                                maxColumns={3}
                            />
                        )}
                    </section>
                )}

                <CtaBand
                    title="Siap menerbitkan buku Anda?"
                    text="Bandingkan semua paket penerbitan atau konsultasikan kebutuhan Anda lebih dulu."
                    action={{ to: '/paket', label: 'Lihat Semua Paket' }}
                />
            </div>
        </div>
    );
}

export default LayananPage;
