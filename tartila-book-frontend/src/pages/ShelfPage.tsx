import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import BookCard from '@/components/BookCard';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';

type Tab = 'reading' | 'saved' | 'liked' | 'purchased' | 'bookmarks';

const TABS: { value: Tab; label: string; empty: string }[] = [
    {
        value: 'reading',
        label: 'Lanjut baca',
        empty: 'Belum ada buku yang Anda baca.',
    },
    {
        value: 'saved',
        label: 'Tersimpan',
        empty: 'Belum ada buku tersimpan. Tekan "Simpan ke rak" di halaman buku.',
    },
    {
        value: 'liked',
        label: 'Disukai',
        empty: 'Belum ada buku yang Anda sukai.',
    },
    {
        value: 'purchased',
        label: 'Dibeli',
        empty: 'Belum ada buku yang dibeli (yang masih aktif).',
    },
    {
        value: 'bookmarks',
        label: 'Penanda',
        empty: 'Belum ada penanda halaman. Tekan ikon penanda saat membaca.',
    },
];

function Books({ tab }: { tab: Exclude<Tab, 'bookmarks'> }) {
    const { data, error } = useLoad(useCallback(() => api.shelf(tab), [tab]));

    if (error) return <p className="text-red-600">{error}</p>;
    if (!data) return <p className="text-oxford-navy-900/70">Memuat...</p>;

    if (data.data.length === 0) {
        return (
            <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                {TABS.find((item) => item.value === tab)?.empty}
            </p>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.data.map((book) => (
                <div key={book.id} className="flex flex-col gap-1">
                    <BookCard book={book} />
                    {tab === 'reading' && book.me?.last_page && (
                        <Link
                            to={`/baca/${book.id}`}
                            className="text-center text-xs font-semibold text-forest-moss-700 hover:underline"
                        >
                            Lanjut dari halaman {book.me.last_page} →
                        </Link>
                    )}
                </div>
            ))}
        </div>
    );
}

function Bookmarks() {
    const { data, error, reload } = useLoad(
        useCallback(() => api.myBookmarks(), [])
    );

    if (error) return <p className="text-red-600">{error}</p>;
    if (!data) return <p className="text-oxford-navy-900/70">Memuat...</p>;

    if (data.data.length === 0) {
        return (
            <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                {TABS[4].empty}
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-2">
            {data.data.map((item) => (
                <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-forest-moss-100"
                >
                    <Link
                        to={`/baca/${item.reader_book_id}`}
                        className="min-w-0 flex-1"
                    >
                        <span className="block truncate font-semibold text-oxford-navy-700">
                            {item.title}
                        </span>
                        <span className="block truncate text-sm text-oxford-navy-900/65">
                            Halaman {item.page}
                            {item.note ? ` — ${item.note}` : ''}
                        </span>
                    </Link>
                    <button
                        type="button"
                        aria-label={`Hapus penanda ${item.title} halaman ${item.page}`}
                        onClick={async () => {
                            await api
                                .deleteBookmark(item.id)
                                .catch(() => undefined);
                            reload();
                        }}
                        className="text-red-600 hover:cursor-pointer"
                    >
                        <i aria-hidden className="ri-delete-bin-line text-lg" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

export default function ShelfPage() {
    const [tab, setTab] = useState<Tab>('reading');

    return (
        <div className="mx-auto flex max-w-[1232px] flex-col gap-6 px-6 py-10 sm:px-10">
            <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                Rak saya
            </h1>

            <div
                role="tablist"
                aria-label="Isi rak"
                className="flex flex-wrap gap-2"
            >
                {TABS.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.value}
                        onClick={() => setTab(item.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold hover:cursor-pointer ${
                            tab === item.value
                                ? 'bg-oxford-navy-700 text-white'
                                : 'bg-forest-moss-50 text-oxford-navy-700 ring-1 ring-forest-moss-200 hover:bg-forest-moss-100'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'bookmarks' ? (
                <Bookmarks />
            ) : (
                <Books key={tab} tab={tab} />
            )}
        </div>
    );
}
