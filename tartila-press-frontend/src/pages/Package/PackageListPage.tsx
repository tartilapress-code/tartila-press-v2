import Card2Flip, {
    PackageCardSkeleton,
} from '@/components/card/flipcard/Card2Flip';
import PackageComparison from '@/components/package/PackageComparison';
import CtaBand from '@/components/ui/CtaBand';
import ListHero from '@/components/ui/ListHero';
import SectionTitle from '@/components/ui/SectionTitle';
import { usePackages } from '@/hooks/usePackages';

/** Semua paket penerbitan, lalu tabel perbandingan fasilitas dan layanannya. */
export default function PackageListPage() {
    const { packages, isLoading } = usePackages();

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge="Paket"
                title={{ before: 'Pilih Paket ', accent: 'Penerbitan' }}
                text="Bandingkan fasilitas dan layanan setiap paket, lalu pilih yang paling sesuai dengan naskah dan anggaran Anda."
                script={['Satu Paket,', 'Banyak Manfaat']}
            />

            <div className="mx-auto flex max-w-[1232px] flex-col gap-12 px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <section
                    aria-labelledby="semua-paket"
                    className="flex flex-col gap-6"
                >
                    <SectionTitle id="semua-paket">
                        Semua Paket
                        {!isLoading && packages.length > 0 && (
                            <span className="font-sans text-sm font-normal text-oxford-navy-900/65">
                                {packages.length} paket
                            </span>
                        )}
                    </SectionTitle>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <PackageCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : packages.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            Belum ada paket yang ditampilkan.
                        </p>
                    ) : (
                        <Card2Flip packages={packages} />
                    )}
                </section>

                {packages.length >= 2 && (
                    <section
                        aria-labelledby="bandingkan-paket"
                        className="flex flex-col gap-6"
                    >
                        <SectionTitle id="bandingkan-paket">
                            Bandingkan Paket
                        </SectionTitle>
                        <PackageComparison packages={packages} />
                    </section>
                )}

                <CtaBand
                    title="Ingin memilih layanan satuan?"
                    text="Rakit paket custom dari layanan dan fasilitas yang Anda butuhkan, atau konsultasikan kebutuhan Anda lebih dulu."
                    action={{ to: '/layanan', label: 'Lihat Layanan' }}
                />
            </div>
        </div>
    );
}
