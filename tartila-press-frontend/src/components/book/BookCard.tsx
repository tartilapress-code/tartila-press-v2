type DummyBook = {
    judul_buku: string;
    sinopsis: string;
    isbn: string;
    penulis: string;
    kategori: string;
    tahun_terbit: number;
    rating: number;
    front_cover: string;
    harga: number;
    diskon: number;
};

export default function BookCard({ book }: { book: DummyBook }) {
    return (
        <div className="flex flex-row gap-4 rounded-xl border border-forest-moss-400 overflow-hidden bg-oxford-navy-900 p-4">
            <img
                src={book.front_cover}
                alt={book.judul_buku}
                className="w-24 h-32 object-cover rounded-lg"
            />
            <div className="flex flex-col gap-1">
                <h5 className="text-white font-semibold">
                    {book.judul_buku}
                </h5>
                <p className="text-white/60 text-sm">{book.penulis}</p>
                <p className="text-white/60 text-xs">{book.kategori}</p>
                <p className="text-forest-moss-300 font-semibold">
                    Rp {book.harga}
                </p>
            </div>
        </div>
    );
}
