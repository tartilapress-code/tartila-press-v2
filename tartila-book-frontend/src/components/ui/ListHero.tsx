import {
    BookStackColor,
    HeroHill,
    HeroLeafRight,
    Sprig,
    Swoosh,
} from '@/components/art/HeroArt';
import PillBadge from '@/components/ui/PillBadge';

type ListHeroProps = {
    badge: string;
    // Judul serif; `accent` berwarna hijau.
    title: { before?: string; accent: string; after?: string };
    text: string;
    // Dua baris kutipan tulisan tangan di sisi kanan (layar lebar saja).
    script: [string, string];
};

/**
 * Hero halaman daftar (Penulis, Editor, Book Chapter): lencana, judul serif
 * dengan bagian hijau, penjelasan, tumpukan buku, dan kutipan tulisan
 * tangan. Ilustrasi hanya tampil di layar lebar.
 */
export default function ListHero({
    badge,
    title,
    text,
    script,
}: ListHeroProps) {
    return (
        <section className="relative isolate overflow-hidden bg-white">
            <HeroHill className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[26%] sm:block" />
            <HeroLeafRight className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[22%] sm:block" />
            <BookStackColor className="pointer-events-none absolute bottom-0 left-[7%] hidden h-[185px] w-auto lg:block" />

            <div className="relative flex flex-col items-start gap-3 px-6 py-8 sm:px-10 lg:min-h-[215px] lg:justify-center lg:py-10 lg:pl-[27%] lg:pr-[30%]">
                <PillBadge label={badge} withIcon />
                <h1 className="font-display text-3xl font-bold leading-tight text-oxford-navy-700 sm:text-4xl xl:text-[2.6rem]">
                    {title.before}
                    <span className="text-forest-moss-600">{title.accent}</span>
                    {title.after}
                </h1>
                <p className="max-w-[34rem] text-[15px] leading-relaxed text-oxford-navy-900/65">
                    {text}
                </p>
            </div>

            <div className="pointer-events-none absolute right-[6%] top-1/2 hidden -translate-y-1/2 xl:block">
                <p className="font-script -rotate-[8deg] text-[1.9rem] leading-[1.1] text-oxford-navy-700">
                    {script[0]}
                    <br />
                    {script[1]}
                </p>
                <Swoosh className="ml-8 mt-2 h-3 w-24 -rotate-[6deg]" />
            </div>
            <Sprig className="pointer-events-none absolute -bottom-1 right-[2%] hidden h-[95px] w-auto xl:block" />
        </section>
    );
}
