import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RiArrowDownSLine,
    RiFolderOpenLine,
    RiListUnordered,
    RiPriceTag3Fill,
    RiSearchLine,
} from '@remixicon/react';

export type FilterOption = { value: string; label: string };

export type CatalogFilters = {
    search: string;
    bookCategoryId: string;
    fieldCategoryId: string;
    sort: string;
};

type CatalogFilterBarProps = {
    filters: CatalogFilters;
    onChange: (patch: Partial<CatalogFilters>) => void;
    bookCategories: FilterOption[];
    fieldCategories: FilterOption[];
    sortOptions: FilterOption[];
};

const fieldRing =
    'ring-1 ring-oxford-navy-900/10 shadow-sm transition focus-within:ring-2 focus-within:ring-forest-moss-500';

// Kotak pilihan: ikon di kiri, label kecil di atas nilai yang tebal. Elemen
// <select> asli tetap dipakai (aksesibel, picker bawaan di ponsel).
function FilterSelect({
    id,
    label,
    icon,
    value,
    options,
    onChange,
    className = '',
}: {
    id: string;
    label: string;
    icon: ReactNode;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    className?: string;
}) {
    return (
        <div
            className={`relative rounded-xl bg-white ${fieldRing} ${className}`}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-oxford-navy-700"
            >
                {icon}
            </span>
            <label
                htmlFor={id}
                className="pointer-events-none absolute left-12 top-2 text-[11px] leading-none text-oxford-navy-900/55"
            >
                {label}
            </label>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-14 w-full cursor-pointer appearance-none truncate rounded-xl bg-transparent pb-0 pl-12 pr-9 pt-5 text-sm font-semibold text-oxford-navy-900 outline-none"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <RiArrowDownSLine
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-oxford-navy-900/60"
            />
        </div>
    );
}

/**
 * Bilah pencarian & filter katalog: kolom cari + kategori buku, kategori
 * keilmuan, dan urutan, dalam satu wadah hijau lembut.
 */
export default function CatalogFilterBar({
    filters,
    onChange,
    bookCategories,
    fieldCategories,
    sortOptions,
}: CatalogFilterBarProps) {
    const { t } = useTranslation();

    return (
        <div className="grid gap-3 rounded-2xl bg-forest-moss-100/60 p-3 ring-1 ring-forest-moss-200/60 sm:p-4 md:grid-cols-6 xl:grid-cols-[1.6fr_1fr_1fr_0.8fr]">
            <div
                className={`relative rounded-xl bg-white md:col-span-4 xl:col-span-1 ${fieldRing}`}
            >
                <RiSearchLine
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-oxford-navy-700"
                />
                <input
                    type="search"
                    value={filters.search}
                    onChange={(e) => onChange({ search: e.target.value })}
                    placeholder={t('books.catalog.filters.searchPlaceholder')}
                    aria-label={t('books.catalog.filters.searchAria')}
                    className="h-14 w-full rounded-xl bg-transparent pl-12 pr-4 text-sm text-oxford-navy-900 outline-none placeholder:text-oxford-navy-900/45"
                />
            </div>

            <FilterSelect
                id="catalog-book-category"
                label={t('books.catalog.filters.bookCategory')}
                icon={<RiFolderOpenLine className="size-5" />}
                value={filters.bookCategoryId}
                options={[
                    {
                        value: '',
                        label: t('books.catalog.filters.allBookCategories'),
                    },
                    ...bookCategories,
                ]}
                onChange={(value) => onChange({ bookCategoryId: value })}
                className="md:col-span-3 xl:col-span-1"
            />
            <FilterSelect
                id="catalog-field-category"
                label={t('books.catalog.filters.fieldCategory')}
                icon={<RiListUnordered className="size-5" />}
                value={filters.fieldCategoryId}
                options={[
                    {
                        value: '',
                        label: t('books.catalog.filters.allFieldCategories'),
                    },
                    ...fieldCategories,
                ]}
                onChange={(value) => onChange({ fieldCategoryId: value })}
                className="md:col-span-3 xl:col-span-1"
            />
            <FilterSelect
                id="catalog-sort"
                label={t('books.catalog.filters.sort')}
                icon={<RiPriceTag3Fill className="size-5" />}
                value={filters.sort}
                options={sortOptions}
                onChange={(value) => onChange({ sort: value })}
                className="md:col-span-2 md:col-start-5 md:row-start-1 xl:col-span-1 xl:col-start-auto xl:row-start-auto"
            />
        </div>
    );
}
