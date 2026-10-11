import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiFileShieldLine,
} from '@remixicon/react';
import ResponsiveImg from '@/components/ui/ResponsiveImg';
import type { AboutLegality } from '@/data/about/aboutApi';
import ImageLightbox from './ImageLightbox';

/**
 * Legalitas: tampil 3 sekaligus (2 di tablet, 1 di ponsel); selebihnya
 * digeser (tombol panah, geser jari, atau gulir). Foto bisa diperbesar.
 */
export default function LegalityCarousel({
    items,
}: {
    items: AboutLegality[];
}) {
    const { t } = useTranslation();
    const trackRef = useRef<HTMLUListElement>(null);
    const [edges, setEdges] = useState({ start: true, end: true });
    const [opened, setOpened] = useState<AboutLegality | null>(null);
    // Stabil, supaya lightbox tidak memindahkan fokus ulang saat carousel
    // dirender ulang.
    const closeLightbox = useCallback(() => setOpened(null), []);

    // Tombol panah hanya aktif bila masih ada kartu ke arah itu.
    useEffect(() => {
        const track = trackRef.current;

        if (!track) return;

        function update() {
            if (!track) return;
            setEdges({
                start: track.scrollLeft <= 4,
                end:
                    track.scrollLeft + track.clientWidth >=
                    track.scrollWidth - 4,
            });
        }

        update();
        track.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);

        return () => {
            track.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [items.length]);

    function slide(direction: 1 | -1) {
        const track = trackRef.current;

        if (!track) return;

        const card = track.querySelector('li');
        const step = card
            ? card.getBoundingClientRect().width + 16
            : track.clientWidth;

        track.scrollBy({ left: direction * step, behavior: 'smooth' });
    }

    const canSlide = !(edges.start && edges.end);

    return (
        <div className="relative">
            <ul
                ref={trackRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin]"
            >
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-white ring-1 ring-forest-moss-100 sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
                    >
                        {item.image_url ? (
                            <button
                                type="button"
                                onClick={() => setOpened(item)}
                                aria-label={t('about.viewPhoto', {
                                    name: item.name,
                                })}
                                className="group block aspect-[4/3] w-full overflow-hidden bg-forest-moss-50"
                            >
                                <ResponsiveImg
                                    src={item.image_url}
                                    sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
                                    alt=""
                                    className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                            </button>
                        ) : (
                            <div
                                aria-hidden
                                className="flex aspect-[4/3] w-full items-center justify-center bg-forest-moss-50 text-forest-moss-600"
                            >
                                <RiFileShieldLine size={48} />
                            </div>
                        )}
                        <div className="flex flex-col gap-1 p-4">
                            <h3 className="font-display text-base font-bold text-oxford-navy-700">
                                {item.name}
                            </h3>
                            {item.description && (
                                <p className="whitespace-pre-line text-sm leading-relaxed text-oxford-navy-900/70">
                                    {item.description}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {canSlide && (
                <div className="mt-3 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => slide(-1)}
                        disabled={edges.start}
                        aria-label={t('about.previous')}
                        className="flex size-10 items-center justify-center rounded-full bg-white text-oxford-navy-700 ring-1 ring-forest-moss-200 transition-colors hover:bg-forest-moss-50 disabled:opacity-40"
                    >
                        <RiArrowLeftSLine size={22} aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => slide(1)}
                        disabled={edges.end}
                        aria-label={t('about.next')}
                        className="flex size-10 items-center justify-center rounded-full bg-white text-oxford-navy-700 ring-1 ring-forest-moss-200 transition-colors hover:bg-forest-moss-50 disabled:opacity-40"
                    >
                        <RiArrowRightSLine size={22} aria-hidden />
                    </button>
                </div>
            )}

            {opened?.image_url && (
                <ImageLightbox
                    src={opened.image_url}
                    title={opened.name}
                    description={opened.description}
                    onClose={closeLightbox}
                />
            )}
        </div>
    );
}
