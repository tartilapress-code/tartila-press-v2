import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import BookCard from '@/components/BookCard';
import Button from '@/components/Button';
import ListHero from '@/components/ui/ListHero';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';
import { formatRupiah } from '@/lib/format';

function Shelf({
    title,
    hint,
    to,
    books,
}: {
    title: string;
    hint: string;
    to: string;
    books: api.ReaderBook[];
}) {
    if (books.length === 0) return null;

    return (
        <section className="mx-auto flex w-full max-w-[1232px] flex-col gap-5 px-6 py-8 sm:px-10">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="font-display text-2xl font-bold text-oxford-navy-700">
                        {title}
                    </h2>
                    <p className="text-sm text-oxford-navy-900/65">{hint}</p>
                </div>
                <Link
                    to={to}
                    className="text-sm font-semibold text-forest-moss-700 hover:underline"
                >
                    Lihat semua →
                </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {books.slice(0, 5).map((book) => (
                    <BookCard key={book.id} book={book} />
                ))}
            </div>
        </section>
    );
}

export default function HomePage() {
    const popular = useLoad(
        useCallback(() => api.catalog({ sort: 'popular', per_page: 5 }), [])
    );
    const newest = useLoad(
        useCallback(() => api.catalog({ sort: 'newest', per_page: 5 }), [])
    );
    const free = useLoad(
        useCallback(() => api.catalog({ access: 'free', per_page: 5 }), [])
    );
    const plans = useLoad(useCallback(() => api.plans(), []));

    const cheapest = plans.data?.data[0];
    const total = newest.data?.meta.total ?? 0;

    return (
        <>
            <ListHero
                badge="Perpustakaan digital Tartila Press"
                title={{
                    before: 'Baca ',
                    accent: 'semua buku',
                    after: ', di mana saja',
                }}
                text="Baca buku terbitan Tartila Press di layar Anda: gulir atau balik halaman. Simpan favorit, tandai halaman penting, dan berlangganan untuk membuka semua buku."
                script={['Satu akun,', 'ribuan halaman']}
            />

            <div className="mx-auto flex max-w-[1232px] flex-wrap items-center gap-3 px-6 pb-2 pt-6 sm:px-10">
                <Link to="/katalog">
                    <Button className="h-12">
                        Jelajahi {total > 0 ? `${total} buku` : 'katalog'}
                    </Button>
                </Link>
                <Link to="/langganan">
                    <Button variant="outline2" className="h-12">
                        Lihat paket langganan
                    </Button>
                </Link>
            </div>

            <Shelf
                title="Gratis dibaca sekarang"
                hint="Dibuka sementara oleh admin."
                to="/katalog?access=free"
                books={free.data?.data ?? []}
            />
            <Shelf
                title="Paling banyak dibaca"
                hint="Berdasarkan pembaca terbanyak pada satu halaman."
                to="/katalog?sort=popular"
                books={popular.data?.data ?? []}
            />
            <Shelf
                title="Baru ditambahkan"
                hint="Buku terbaru di Tartila Book."
                to="/katalog?sort=newest"
                books={newest.data?.data ?? []}
            />

            {newest.data && newest.data.data.length === 0 && (
                <p className="mx-auto max-w-[1232px] px-6 py-10 text-center text-oxford-navy-900/65">
                    Belum ada buku. Admin sedang menyiapkan koleksi pertama.
                </p>
            )}

            {cheapest && (
                <section className="mx-auto mt-4 max-w-[1232px] px-6 sm:px-10">
                    <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-oxford-navy-700 p-8 text-white sm:flex-row sm:items-center">
                        <div className="flex flex-col gap-1">
                            <h2 className="font-display text-2xl font-bold">
                                Berlangganan, baca semuanya
                            </h2>
                            <p className="text-white/80">
                                Mulai {formatRupiah(cheapest.price)} /{' '}
                                {cheapest.period_label.toLowerCase()}. Semua
                                buku terbuka selama langganan aktif.
                            </p>
                        </div>
                        <Link to="/langganan">
                            <Button variant="white" className="h-12">
                                Pilih paket
                            </Button>
                        </Link>
                    </div>
                </section>
            )}
        </>
    );
}
