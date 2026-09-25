import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { packages, isLoading } = usePackages();

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge={t('packages.list.badge')}
                title={{
                    before: t('packages.list.heroBefore'),
                    accent: t('packages.list.heroAccent'),
                }}
                text={t('packages.list.heroText')}
                script={[
                    t('packages.list.scriptTop'),
                    t('packages.list.scriptBottom'),
                ]}
            />

            <div className="mx-auto flex max-w-[1232px] flex-col gap-12 px-4 pb-20 pt-8 sm:px-8 lg:px-10">
                <section
                    aria-labelledby="semua-paket"
                    className="flex flex-col gap-6"
                >
                    <SectionTitle id="semua-paket">
                        {t('packages.list.all')}
                        {!isLoading && packages.length > 0 && (
                            <span className="font-sans text-sm font-normal text-oxford-navy-900/65">
                                {t('packages.list.count', {
                                    count: packages.length,
                                })}
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
                            {t('packages.empty')}
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
                            {t('packages.compare')}
                        </SectionTitle>
                        <PackageComparison packages={packages} />
                    </section>
                )}

                <CtaBand
                    title={t('packages.list.ctaTitle')}
                    text={t('packages.list.ctaText')}
                    action={{
                        to: '/layanan',
                        label: t('packages.list.ctaAction'),
                    }}
                />
            </div>
        </div>
    );
}
