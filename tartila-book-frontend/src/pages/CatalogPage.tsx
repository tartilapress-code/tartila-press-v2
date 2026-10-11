import { useCallback, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookCard from '@/components/BookCard';
import Pagination from '@/components/Pagination';
import * as api from '@/data/readerApi';
import { useLoad } from '@/hooks/useLoad';

const selectClass =
    'h-10 w-full rounded-lg border border-oxford-navy-900/15 bg-white px-3 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500';

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1 text-sm font-medium text-oxford-navy-900">
            {label}
            {children}
        </label>
    );
}

/** Katalog: pencarian + filter jenis pustaka, bidang, kategori, genre, usia, bahasa, akses. */
export default function CatalogPage() {
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState<string>(params.get('q') ?? '');

    const get = (key: string) => params.get(key) ?? '';
    const pustaka = get('pustaka');
    const page = Number(get('page') || 1);

    const filters = useLoad(useCallback(() => api.filters(), []));
    const query = params.toString();
    const list = useLoad(
        useCallback(
            () =>
                api.catalog({
                    q: get('q'),
                    pustaka: get('pustaka'),
                    education_field_id: get('education_field_id'),
                    category_id: get('category_id'),
                    genre_id: get('genre_id'),
                    age_limit: get('age_limit'),
                    language: get('language'),
                    access: get('access'),
                    sort: get('sort') || 'newest',
                    page,
                    per_page: 12,
                }),
            // `query` mewakili seluruh parameter di URL.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [query]
        )
    );

    function setParam(key: string, value: string, resetPage = true) {
        const next = new URLSearchParams(params);

        if (value) next.set(key, value);
        else next.delete(key);

        // Mengganti jenis pustaka membuang pilihan yang hanya berlaku untuk jenis lain.
        if (key === 'pustaka') {
            [
                'education_field_id',
                'genre_id',
                'age_limit',
                'category_id',
            ].forEach((name) => next.delete(name));
        }

        if (resetPage) next.delete('page');
        setParams(next, { replace: true });
    }

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        setParam('q', search.trim());
    }

    const data = filters.data?.data;
    const categories = (data?.categories ?? []).filter(
        (item) => !pustaka || !item.pustaka || item.pustaka === pustaka
    );
    const hasFilter = [
        'q',
        'pustaka',
        'education_field_id',
        'category_id',
        'genre_id',
        'age_limit',
        'language',
        'access',
    ].some((key) => get(key));
    const books = list.data?.data ?? [];

    return (
        <div className="mx-auto flex max-w-[1232px] flex-col gap-6 px-6 py-8 sm:px-10">
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-3xl font-bold text-oxford-navy-700">
                    Katalog buku
                </h1>
                <p className="text-oxford-navy-900/65">
                    Temukan buku menurut jenis, bidang, kategori, dan bahasa.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_1fr]">
                <aside
                    aria-label="Filter buku"
                    className="card-shadow flex h-fit flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-forest-moss-100"
                >
                    <form
                        onSubmit={submitSearch}
                        role="search"
                        className="flex gap-2"
                    >
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Cari judul atau penulis"
                            placeholder="Cari judul / penulis"
                            className={selectClass}
                        />
                        <button
                            type="submit"
                            aria-label="Cari"
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-oxford-navy-700 text-white hover:cursor-pointer hover:bg-oxford-navy-600"
                        >
                            <i aria-hidden className="ri-search-line" />
                        </button>
                    </form>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-sm font-medium text-oxford-navy-900">
                            Jenis pustaka
                        </legend>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: '', label: 'Semua' },
                                ...(data?.pustaka ?? []),
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={pustaka === option.value}
                                    onClick={() =>
                                        setParam('pustaka', option.value)
                                    }
                                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold hover:cursor-pointer ${
                                        pustaka === option.value
                                            ? 'bg-oxford-navy-700 text-white'
                                            : 'bg-forest-moss-50 text-oxford-navy-700 ring-1 ring-forest-moss-200 hover:bg-forest-moss-100'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {pustaka !== 'fiksi' &&
                        (data?.education_fields.length ?? 0) > 0 && (
                            <Field label="Bidang pendidikan">
                                <select
                                    className={selectClass}
                                    value={get('education_field_id')}
                                    onChange={(e) =>
                                        setParam(
                                            'education_field_id',
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Semua bidang</option>
                                    {data?.education_fields.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        )}

                    {categories.length > 0 && (
                        <Field label="Kategori buku">
                            <select
                                className={selectClass}
                                value={get('category_id')}
                                onChange={(e) =>
                                    setParam('category_id', e.target.value)
                                }
                            >
                                <option value="">Semua kategori</option>
                                {categories.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    {pustaka !== 'non_fiksi' &&
                        (data?.genres.length ?? 0) > 0 && (
                            <Field label="Genre">
                                <select
                                    className={selectClass}
                                    value={get('genre_id')}
                                    onChange={(e) =>
                                        setParam('genre_id', e.target.value)
                                    }
                                >
                                    <option value="">Semua genre</option>
                                    {data?.genres.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        )}

                    {pustaka === 'fiksi' && (
                        <Field label="Batas usia">
                            <select
                                className={selectClass}
                                value={get('age_limit')}
                                onChange={(e) =>
                                    setParam('age_limit', e.target.value)
                                }
                            >
                                <option value="">Semua usia</option>
                                {data?.age_limits.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    {(data?.languages.length ?? 0) > 1 && (
                        <Field label="Bahasa">
                            <select
                                className={selectClass}
                                value={get('language')}
                                onChange={(e) =>
                                    setParam('language', e.target.value)
                                }
                            >
                                <option value="">Semua bahasa</option>
                                {data?.languages.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <Field label="Akses">
                        <select
                            className={selectClass}
                            value={get('access')}
                            onChange={(e) => setParam('access', e.target.value)}
                        >
                            <option value="">Semua</option>
                            <option value="free">Gratis dibaca sekarang</option>
                            <option value="paid">Bisa dibeli satuan</option>
                        </select>
                    </Field>

                    {hasFilter && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setParams({}, { replace: true });
                            }}
                            className="self-start text-sm font-semibold text-forest-moss-700 hover:cursor-pointer hover:underline"
                        >
                            Hapus semua filter
                        </button>
                    )}
                </aside>

                <section
                    className="flex min-w-0 flex-col gap-4"
                    aria-live="polite"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-oxford-navy-900/70">
                            {list.loading && !list.data
                                ? 'Memuat...'
                                : `${list.data?.meta.total ?? 0} buku ditemukan`}
                        </p>
                        <label className="flex items-center gap-2 text-sm text-oxford-navy-900">
                            Urutkan
                            <select
                                className={`${selectClass} w-44`}
                                value={get('sort') || 'newest'}
                                onChange={(e) =>
                                    setParam(
                                        'sort',
                                        e.target.value === 'newest'
                                            ? ''
                                            : e.target.value
                                    )
                                }
                            >
                                <option value="newest">Terbaru</option>
                                <option value="popular">
                                    Pembaca terbanyak
                                </option>
                                <option value="liked">Paling disukai</option>
                            </select>
                        </label>
                    </div>

                    {list.error && (
                        <p className="text-sm text-red-600">{list.error}</p>
                    )}

                    {!list.loading && books.length === 0 && !list.error ? (
                        <p className="rounded-2xl bg-forest-moss-50 p-8 text-center text-oxford-navy-900/70">
                            Tidak ada buku yang cocok. Coba ubah atau hapus
                            filter.
                        </p>
                    ) : (
                        <div
                            className={`grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 ${list.loading ? 'opacity-60' : ''}`}
                        >
                            {books.map((book) => (
                                <BookCard key={book.id} book={book} />
                            ))}
                        </div>
                    )}

                    <Pagination
                        meta={list.data?.meta ?? null}
                        onPageChange={(next) => {
                            setParam(
                                'page',
                                next > 1 ? String(next) : '',
                                false
                            );
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                </section>
            </div>
        </div>
    );
}
