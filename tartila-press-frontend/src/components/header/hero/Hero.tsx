import { HashLink } from 'react-router-hash-link';
import { RiWhatsappLine } from '@remixicon/react';
import hero from '../../../data/hero.json';
import slogan from '../../../data/slogan.json';
import logo from '../../../assets/logo/logo.png';
import photo from '../../../assets/images/buku.png';
import Button from '@/components/Button/Button';
import {
    BookStackColor,
    HeroHill,
    HeroLeafRight,
    Sprig,
} from '@/components/art/HeroArt';
import PillBadge from '@/components/ui/PillBadge';

// Nomor WhatsApp untuk tombol "Konsultasi".
const WHATSAPP_URL = 'https://wa.me/6283180773955';

// Nama penerbit di akhir judul diberi warna hijau.
function splitHeadline(headline: string): { before: string; accent: string } {
    const index = headline.lastIndexOf(slogan.name);

    return index > 0
        ? { before: headline.slice(0, index), accent: slogan.name }
        : { before: headline, accent: '' };
}

/**
 * Hero beranda (tema terang): lencana, judul serif, penjelasan, tombol
 * "Lihat Paket" / "Konsultasi", dan foto rak buku dalam bingkai berhias
 * bukit, daun, serta tumpukan buku.
 */
export default function Hero(): React.ReactNode {
    const { before, accent } = splitHeadline(hero.headline);

    return (
        <section
            id="home"
            className="relative isolate -mx-10 -my-2 scroll-mt-20 overflow-hidden bg-white"
        >
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[22%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[16%] sm:block" />

            <div className="mx-auto grid max-w-[1232px] items-center gap-10 px-6 py-12 sm:px-10 lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-16">
                <div className="flex flex-col items-start gap-6">
                    <PillBadge label="Penerbit Independen" withIcon />
                    <h1 className="font-display text-4xl font-bold leading-tight text-oxford-navy-700 sm:text-5xl xl:text-[3.3rem]">
                        {before}
                        {accent && (
                            <span className="text-forest-moss-600">
                                {accent}
                            </span>
                        )}
                    </h1>
                    <p className="max-w-xl text-lg leading-relaxed text-oxford-navy-900/70">
                        {hero.subheadline}
                    </p>

                    <div className="flex flex-row flex-wrap gap-3">
                        <HashLink to="#paket" smooth>
                            <Button variant="primary" className="px-6">
                                Lihat Paket
                            </Button>
                        </HashLink>
                        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                            <Button
                                variant="outline2"
                                className="inline-flex items-center gap-2 px-6"
                            >
                                <RiWhatsappLine
                                    aria-hidden
                                    className="size-5 text-forest-moss-600"
                                />
                                Konsultasi
                            </Button>
                        </a>
                    </div>
                </div>

                <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                    <div
                        aria-hidden
                        className="absolute -right-4 -top-4 h-full w-full rounded-[2rem] bg-forest-moss-100"
                    />
                    <img
                        src={photo}
                        alt="Rak buku di perpustakaan"
                        className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-[0_18px_44px_-18px_rgba(1,26,44,0.5)]"
                    />
                    <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-forest-moss-100 bg-white px-4 py-3 shadow-[0_10px_28px_-12px_rgba(1,26,44,0.4)] sm:left-6">
                        <img src={logo} alt="" className="h-10 w-auto" />
                        <div className="flex flex-col">
                            <span className="font-display text-base font-bold leading-tight text-oxford-navy-700">
                                {slogan.name}
                            </span>
                            <span className="font-display text-xs text-oxford-navy-900/70">
                                {slogan.slogan}
                            </span>
                        </div>
                    </div>
                    <BookStackColor className="pointer-events-none absolute -right-2 bottom-0 hidden h-[130px] w-auto translate-y-1/3 lg:block" />
                </div>
            </div>

            <Sprig className="pointer-events-none absolute -bottom-1 left-[3%] hidden h-[95px] w-auto xl:block" />
        </section>
    );
}
