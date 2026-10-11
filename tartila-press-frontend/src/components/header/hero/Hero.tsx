import { useEffect, useState } from 'react';
import { HashLink } from 'react-router-hash-link';
import { useTranslation } from 'react-i18next';
import { RiWhatsappLine } from '@remixicon/react';
import { useAboutPage } from '@/hooks/useAboutPage';
import { whatsappUrl } from '@/lib/siteContact';
import Button from '@/components/Button/Button';
import { HeroHill, HeroLeafRight, Sprig } from '@/components/art/HeroArt';
import PillBadge from '@/components/ui/PillBadge';
import * as bookApi from '@/data/book/bookApi';
import type { HeroCover } from '@/data/book/bookApi';
import HeroShowcase, { HeroShowcaseSkeleton } from './HeroShowcase';

/**
 * Hero beranda (tema terang): lencana, judul serif, penjelasan, tombol
 * "Lihat Paket" / "Konsultasi", dan etalase sampul buku terbaru (lihat
 * HeroShowcase).
 */
export default function Hero(): React.ReactNode {
    const { t } = useTranslation();
    // Nomor WhatsApp dari halaman Tentang Kami (diatur admin).
    const { about } = useAboutPage();
    const whatsappLink = whatsappUrl(about.profile.whatsapp);
    const brandName = t('common.brand.name');
    // null = sedang dimuat.
    const [covers, setCovers] = useState<HeroCover[] | null>(null);

    useEffect(() => {
        bookApi
            .heroCovers()
            .then((response) => setCovers(response.data))
            .catch(() => setCovers([]));
    }, []);

    return (
        <section
            id="home"
            className="relative isolate -mx-10 -my-2 scroll-mt-20 overflow-hidden bg-white"
        >
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[22%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[16%] sm:block" />

            <div className="mx-auto grid max-w-[1232px] items-center gap-10 px-6 py-12 sm:px-10 lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-16">
                <div className="flex flex-col items-start gap-6">
                    <PillBadge label={t('home.hero.badge')} withIcon />
                    <h1 className="font-display text-4xl font-bold leading-tight text-oxford-navy-700 sm:text-5xl xl:text-[3.3rem]">
                        {t('home.hero.headlineLead')}{' '}
                        {/* Nama penerbit di akhir judul diberi warna hijau. */}
                        <span className="text-forest-moss-600">
                            {brandName}
                        </span>
                    </h1>
                    <p className="max-w-xl text-lg leading-relaxed text-oxford-navy-900/70">
                        {t('home.hero.subheadline')}
                    </p>

                    <div className="flex flex-row flex-wrap gap-3">
                        <HashLink to="#paket" smooth>
                            <Button variant="primary" className="px-6">
                                {t('home.hero.viewPackages')}
                            </Button>
                        </HashLink>
                        <a href={whatsappLink} target="_blank" rel="noreferrer">
                            <Button
                                variant="outline2"
                                className="inline-flex items-center gap-2 px-6"
                            >
                                <RiWhatsappLine
                                    aria-hidden
                                    className="size-5 text-forest-moss-600"
                                />
                                {t('common.consult')}
                            </Button>
                        </a>
                    </div>
                </div>

                <div className="relative mx-auto w-full max-w-[28rem] sm:max-w-[32rem] lg:max-w-none">
                    {covers === null ? (
                        <HeroShowcaseSkeleton />
                    ) : (
                        <HeroShowcase covers={covers} />
                    )}
                </div>
            </div>

            <Sprig className="pointer-events-none absolute -bottom-1 left-[3%] hidden h-[95px] w-auto xl:block" />
        </section>
    );
}
