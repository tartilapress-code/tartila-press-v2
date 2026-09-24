import {
    BooksAndPlant,
    LeafBranch,
} from '@/components/book/catalog/CatalogArt';

/**
 * Hero katalog: judul serif, penjelasan singkat, ilustrasi buku & tanaman,
 * dan kutipan. Ilustrasi hanya tampil di layar lebar.
 */
export default function CatalogHero() {
    return (
        <section className="relative overflow-hidden bg-linear-to-br from-white via-white to-oxford-navy-50/70">
            <LeafBranch className="pointer-events-none absolute -left-14 top-2 hidden h-[300px] w-auto sm:block" />

            <div className="relative flex flex-col justify-center gap-3 px-6 py-8 sm:px-10 lg:min-h-[230px] lg:pl-36 lg:pr-[46%] xl:pl-44 xl:pr-[50%]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-moss-700">
                    Katalog Buku
                </p>
                <h1 className="font-display text-3xl font-bold leading-[1.15] text-oxford-navy-700 xl:text-[2.15rem]">
                    Jelajahi Buku-buku <br className="hidden sm:block" />
                    Terbitan Tartila Press.
                </h1>
                <p className="max-w-md text-[15px] leading-relaxed text-oxford-navy-900/65">
                    Buku berkualitas untuk menambah ilmu, memperluas wawasan,
                    dan menguatkan peradaban.
                </p>
            </div>

            <BooksAndPlant className="pointer-events-none absolute bottom-0 right-6 hidden h-[200px] w-auto lg:block xl:right-[20%]" />

            <figure className="absolute right-10 top-1/2 hidden w-[190px] -translate-y-1/2 xl:block">
                <blockquote className="font-display text-xl italic leading-snug text-oxford-navy-700/90">
                    “Ilmu yang baik adalah yang memberi manfaat bagi banyak
                    orang.”
                </blockquote>
                <span className="mt-4 block h-0.5 w-16 rounded bg-forest-moss-500" />
            </figure>
        </section>
    );
}
